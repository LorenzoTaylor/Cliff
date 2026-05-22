#!/usr/bin/env bash
# deploy.sh — build and deploy cliff-agent to AWS ECS Fargate
# Prerequisites: aws configure, Docker Desktop running, backend/.env populated
set -euo pipefail
export MSYS_NO_PATHCONV=1  # prevent Git Bash from converting /foo paths to C:/Program Files/Git/foo

REGION="us-east-1"
REPO_NAME="cliff-agent"
CLUSTER="cliff-cluster"
SERVICE="cliff-service"
TASK_FAMILY="cliff-agent"
LOG_GROUP="/ecs/cliff-agent"
ROLE_NAME="cliff-ecs-execution-role"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=".env"  # relative — script must be run from backend/

# ── 0. Validate prerequisites ────────────────────────────────────────────────

if ! command -v aws &>/dev/null; then
  echo "ERROR: AWS CLI not found. Install from https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker not found. Install Docker Desktop."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example to .env and fill in values."
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"

echo "Account: $ACCOUNT_ID  Region: $REGION"

# ── 1. ECR repository ────────────────────────────────────────────────────────

echo "==> Creating ECR repository (idempotent)..."
aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" &>/dev/null \
  || aws ecr create-repository --repository-name "$REPO_NAME" --region "$REGION" --output text --query 'repository.repositoryUri'

# ── 2. Build and push Docker image ──────────────────────────────────────────

echo "==> Authenticating Docker to ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

echo "==> Building Docker image..."
docker build -t "$REPO_NAME:latest" .

echo "==> Pushing image to ECR..."
docker tag "$REPO_NAME:latest" "$ECR_URI:latest"
docker push "$ECR_URI:latest"

# ── 3. SSM Parameter Store secrets ──────────────────────────────────────────

echo "==> Pushing secrets to SSM Parameter Store..."

# Use Python to parse .env (handles BOM, \r\n, quotes, inline comments reliably)
python3 - "$ENV_FILE" "$REGION" << 'PYEOF'
import sys, subprocess, re

env_file, region = sys.argv[1], sys.argv[2]

with open(env_file, encoding='utf-8-sig') as f:
    lines = f.read().splitlines()

for line in lines:
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    if '=' not in line:
        continue
    key, _, val = line.partition('=')
    key = key.strip()
    val = val.strip().strip('"').strip("'")
    val = re.sub(r'\s+#.*$', '', val).strip()
    if not key or not val:
        continue
    print(f'    /cliff/{key}')
    r = subprocess.run(
        ['aws', 'ssm', 'put-parameter',
         '--region', region,
         '--name', f'/cliff/{key}',
         '--value', val,
         '--type', 'SecureString',
         '--overwrite'],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print(f'ERROR pushing {key}: {r.stderr}', file=sys.stderr)
        sys.exit(1)
PYEOF

# ── 4. IAM execution role ────────────────────────────────────────────────────

echo "==> Setting up ECS task execution role..."

TRUST_POLICY='{
  "Version":"2012-10-17",
  "Statement":[{
    "Effect":"Allow",
    "Principal":{"Service":"ecs-tasks.amazonaws.com"},
    "Action":"sts:AssumeRole"
  }]
}'

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null \
  || aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --query 'Role.Arn' --output text)

# Attach managed policy for ECR pull + CloudWatch logs
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  2>/dev/null || true

# Inline policy granting SSM parameter reads under /cliff/
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name cliff-ssm-read \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"ssm:GetParameters\",\"ssm:GetParameter\"],
      \"Resource\":\"arn:aws:ssm:$REGION:$ACCOUNT_ID:parameter/cliff/*\"
    },{
      \"Effect\":\"Allow\",
      \"Action\":\"kms:Decrypt\",
      \"Resource\":\"*\"
    }]
  }"

# ── 5. CloudWatch log group ──────────────────────────────────────────────────

aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" \
  | grep -q "$LOG_GROUP" \
  || aws logs create-log-group --log-group-name "$LOG_GROUP" --region "$REGION"

# ── 6. ECS cluster ───────────────────────────────────────────────────────────

echo "==> Creating ECS cluster..."
aws ecs create-cluster --cluster-name "$CLUSTER" --region "$REGION" --output text --query 'cluster.clusterName' > /dev/null

# ── 7. Build secrets list for task definition ────────────────────────────────

# Build secrets JSON from .env keys (Python handles BOM/line endings)
SECRETS_JSON=$(python3 - "$ENV_FILE" "$REGION" "$ACCOUNT_ID" << 'PYEOF'
import sys, re, json

env_file, region, account = sys.argv[1], sys.argv[2], sys.argv[3]

with open(env_file, encoding='utf-8-sig') as f:
    lines = f.read().splitlines()

secrets = []
for line in lines:
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, _, val = line.partition('=')
    key = key.strip()
    val = val.strip().strip('"').strip("'")
    val = re.sub(r'\s+#.*$', '', val).strip()
    if key and val:
        secrets.append({
            'name': key,
            'valueFrom': f'arn:aws:ssm:{region}:{account}:parameter/cliff/{key}'
        })

print(json.dumps(secrets))
PYEOF
)

# ── 8. ECS task definition ───────────────────────────────────────────────────

echo "==> Registering ECS task definition..."
aws ecs register-task-definition \
  --region "$REGION" \
  --family "$TASK_FAMILY" \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu "1024" \
  --memory "2048" \
  --execution-role-arn "$ROLE_ARN" \
  --container-definitions "[{
    \"name\":\"$REPO_NAME\",
    \"image\":\"$ECR_URI:latest\",
    \"essential\":true,
    \"secrets\":$SECRETS_JSON,
    \"logConfiguration\":{
      \"logDriver\":\"awslogs\",
      \"options\":{
        \"awslogs-group\":\"$LOG_GROUP\",
        \"awslogs-region\":\"$REGION\",
        \"awslogs-stream-prefix\":\"ecs\"
      }
    }
  }]" \
  --output text --query 'taskDefinition.taskDefinitionArn' \
  > /dev/null

# ── 9. VPC / subnet / security group ────────────────────────────────────────

echo "==> Looking up default VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
  --region "$REGION" \
  --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text)

SUBNET_IDS=$(aws ec2 describe-subnets \
  --region "$REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" \
  --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')

# Use first two subnets for availability
SUBNET_LIST=$(echo "$SUBNET_IDS" | cut -d',' -f1,2)

# Security group — egress only (agent calls out to LiveKit Cloud / APIs)
SG_NAME="cliff-agent-sg"
SG_ID=$(aws ec2 describe-security-groups \
  --region "$REGION" \
  --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)

if [[ "$SG_ID" == "None" || -z "$SG_ID" ]]; then
  SG_ID=$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name "$SG_NAME" \
    --description "Cliff agent - egress only" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' --output text)
  aws ec2 authorize-security-group-egress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol -1 --cidr 0.0.0.0/0 2>/dev/null || true
fi

# ── 10. ECS service ──────────────────────────────────────────────────────────

echo "==> Creating/updating ECS service..."

NETWORK_CONFIG="awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$SG_ID],assignPublicIp=ENABLED}"

SERVICE_EXISTS=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION" \
  --query "services[?status=='ACTIVE'].serviceName" \
  --output text 2>/dev/null)

if [[ -n "$SERVICE_EXISTS" ]]; then
  echo "    Service exists — forcing new deployment..."
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --task-definition "$TASK_FAMILY" \
    --force-new-deployment \
    --region "$REGION" \
    --output text --query 'service.serviceName' > /dev/null
else
  aws ecs create-service \
    --cluster "$CLUSTER" \
    --service-name "$SERVICE" \
    --task-definition "$TASK_FAMILY" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "$NETWORK_CONFIG" \
    --region "$REGION" \
    --output text --query 'service.serviceName' > /dev/null
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "Deployment complete."
echo ""
echo "  ECS console : https://$REGION.console.aws.amazon.com/ecs/v2/clusters/$CLUSTER/services/$SERVICE/tasks"
echo "  CloudWatch  : https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group/$LOG_GROUP"
echo ""
echo "Wait ~60 s for the task to reach RUNNING, then check CloudWatch logs for the LiveKit worker startup."
