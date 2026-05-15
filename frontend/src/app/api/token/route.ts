import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const serverUrl = process.env.LIVEKIT_URL!;

  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const city = searchParams.get("city");

  const roomName = `cliff-${Date.now()}`;
  const participantName = `user-${Math.random().toString(36).slice(2, 8)}`;

  const locationLabel = city ?? (lat && lng ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : null);
  const metadata = locationLabel ? JSON.stringify({ location: locationLabel }) : undefined;

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    ttl: "1h",
    metadata,
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    serverUrl,
    roomName,
  });
}
