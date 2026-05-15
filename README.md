# Cliff — Bay Area Outdoor Voice Agent

Cliff is a RAG-enabled voice agent built on LiveKit that helps Bay Area outdoor enthusiasts find trails, fishing spots, climbing crags, and more. He speaks with the warmth and enthusiasm of Steve Irwin, knows every corner of the Bay Area, and can answer specific regulatory and administrative questions from a curated knowledge base of park guides and land management documents.

**Live demo:** _(Vercel link — add after deployment)_

---

## How It Works — End to End

```
User speaks → Deepgram STT → GPT-4o (with tools) → ElevenLabs TTS → User hears
                                    ↓
                          Tool calls (4 available):
                          • get_weather         — Google Weather API
                          • get_fire_and_closures — NIFC WFIGS ArcGIS
                          • find_nearby_spots   — Google Places Nearby/Text Search
                          • search_knowledge_base — FAISS vector store (RAG)
                                    ↓
                          find_nearby_spots publishes structured place data
                          over LiveKit DataChannel (topic: "cliff:places")
                                    ↓
                          Frontend receives places → renders map pins + sidebar
```

The frontend is a Next.js app. On "Start Call" it fetches a short-lived LiveKit token from `/api/token` (which encodes the user's GPS coordinates in participant metadata), then joins the LiveKit room. The Python backend agent joins the same room, receives the coordinates from participant metadata, and uses them as the default location for all tool calls throughout the session.

---

## RAG Integration

**Knowledge base:** A collection of Bay Area park PDFs — trail guides, land management documents, ranger district references, and fishing/hunting regulations — stored in `backend/data/pdfs/`.

**Ingestion** (`backend/scripts/ingest.py`):
1. Loads every PDF in `data/pdfs/` using `PyPDFLoader`
2. Skips image-only pages (fewer than 100 characters of extractable text)
3. Splits with `RecursiveCharacterTextSplitter` — chunk size 1000, overlap 200
4. Embeds with OpenAI `text-embedding-3-small`
5. Persists a FAISS index to `backend/vector_store/`

**Retrieval** (`backend/agent/rag.py`):
- At agent startup, loads the saved FAISS index
- Returns a retriever with `k=6` — fetches the 6 most similar chunks per query
- Falls back to a no-op retriever (RAG silently disabled) if the vector store hasn't been built yet

**Tool routing:** The `search_knowledge_base` tool docstring explicitly lists all query types it handles (regulations, ranger contacts, permit requirements, district/regional staff names, organizational contacts, management areas, fees). The system prompt contains a strict rule: call `search_knowledge_base` first for any specific factual question before answering from training data or deflecting.

---

## Tool Calls

| Tool | Description | API / Source |
|------|-------------|--------------|
| `get_weather` | Current conditions for a Bay Area location | Google Weather API (server-side) |
| `get_fire_and_closures` | Active fire incidents within 80 km | NIFC WFIGS ArcGIS REST (public, no key) |
| `find_nearby_spots` | Outdoor trailheads/spots for hiking, fishing, hunting, biking, climbing, dirtbiking | Google Places Nearby Search + Text Search |
| `search_knowledge_base` | Specific facts from park PDFs — ranger contacts, regulations, district staff | FAISS RAG over local vector store |

`find_nearby_spots` returns results to the LLM as a text summary, but also publishes a structured JSON payload (place IDs, names, lat/lng, ratings, photo references) to the LiveKit room over a DataChannel with topic `cliff:places`. The frontend subscribes to this topic and renders map pins and a detail sidebar.

---

## Frontend Features

- Full-screen Google Maps canvas with place pins
- Agent panel (centered on idle, slides to left sidebar when places are returned)
- Places sidebar — list view with thumbnails and a detail view with:
  - Photo carousel (up to 5 photos, proxied server-side)
  - Phone number (fetched via Places Details API)
  - Get Directions link
  - Nearest ranger station (searched via Places textSearch)
  - Current weather
  - Nearby active wildfires
- Live transcript (agent + user turns)
- Dark/light theme toggle
- Animated orb that reflects agent state (listening / thinking / speaking)

---

## Stack

**Backend**
- [LiveKit Agents](https://docs.livekit.io/agents/) — room management, agent lifecycle
- [Silero VAD](https://github.com/snakers4/silero-vad) — voice activity detection
- [Deepgram Nova-2](https://deepgram.com/) — speech-to-text
- [OpenAI GPT-4o](https://platform.openai.com/) — LLM
- [ElevenLabs](https://elevenlabs.io/) — text-to-speech
- [LangChain](https://langchain.com/) — RAG orchestration, document loaders, text splitter
- [FAISS](https://faiss.ai/) — local vector store
- [httpx](https://www.python-httpx.org/) — async HTTP for tool calls

**Frontend**
- [Next.js 14](https://nextjs.org/) (App Router)
- [@livekit/components-react](https://github.com/livekit/components-js) — LiveKit React hooks
- [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/) — Maps, markers, Places API
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)

---

## Design Decisions

### LLM: GPT-4o
GPT-4o was chosen for its reliable structured function-calling — it respects tool docstrings and system prompt rules more consistently than smaller models. The trade-off is cost and latency: GPT-4o is slower and more expensive per token than GPT-4o-mini or Claude Haiku. For a voice conversation where responses need to feel fast, this matters, but the improvement in instruction-following (especially around tool routing and persona adherence) made it worth it. A future iteration could experiment with GPT-4o-mini once the system prompt and tool descriptions are locked in.

### RAG: FAISS (local file) over a hosted vector DB
FAISS on disk was chosen over a hosted solution like Pinecone or Supabase pgvector because the knowledge base is static — Bay Area park documents don't change at runtime. FAISS eliminates network round trips, removes an external dependency, and keeps the ingestion pipeline self-contained. The cost of this choice is operational: adding or updating PDFs requires re-running `ingest.py` and redeploying. If the knowledge base needed to grow dynamically (user uploads, live closures feeds), a hosted vector DB would be the right call.

### Chunking: 1000 chars / 200 overlap
The chunk size started at 800 and was bumped to 1000 after testing showed that some regulations and trail descriptions were getting cut in half. Larger chunks keep more context together but risk diluting the similarity signal — a 1000-char chunk about trail fees may score lower on a query about ranger contacts than a tightly scoped 400-char chunk would. The 200-char overlap is a hedge against facts that straddle a chunk boundary being lost entirely. Going larger (2000+) would hurt retrieval precision.

### k=6 retrieval
The default retriever `k=4` missed answers that were present in the index but ranked 5th or 6th by cosine similarity. Bumping to 6 fixed several cases where the agent deflected instead of answering. The trade-off is slightly more tokens in the LLM context per tool call, which adds cost and a small latency hit. Going too high (k=15+) risks overwhelming the LLM with marginally relevant text and degrading answer quality.

### Places data via LiveKit DataChannel, not a polling endpoint
When `find_nearby_spots` fires, the backend publishes structured place data (place IDs, lat/lng, photos) directly into the LiveKit room over a DataChannel. The frontend already has an open WebSocket connection to LiveKit, so the data arrives instantly with no polling loop or extra HTTP endpoint needed. The trade-off is that this coupling means the map only updates when the agent explicitly fires the tool — there's no way for the frontend to independently request a refresh. That's fine here since the map is always a direct response to what the user asked Cliff.

### Photo proxy (`/api/photo`)
Browser-side Google Places Photo URLs fail silently when the Maps API key has HTTP referrer restrictions — the `<img>` `onError` handler just hides the image. Routing photo requests through a Next.js server-side API route (`/api/photo`) uses the unrestricted `GOOGLE_PLACES_API_KEY` and avoids exposing it to the browser. The cost is a small extra hop through the Next.js server on every photo load. The same proxy pattern handles the Weather API (`/api/weather`) for the same reason.

### Agent location from participant metadata
The user's GPS coordinates are embedded in the LiveKit token at generation time and read by the agent when it joins the room. This means Cliff knows where the user is before they say anything — no "where are you?" turn needed and no location-detection latency mid-conversation. The limitation is that the coordinates are snapshot at call start; if the user is moving (e.g., driving to a trailhead), the location won't update during the session.

### RAG tool routing: explicit system prompt rule
GPT-4o routes tool calls based heavily on docstring content. In early testing, asking "who is the region manager for Bay Region 3" caused the agent to say it couldn't help and redirect to trail recommendations — the knowledge base tool's docstring only listed narrow examples like "fishing license" and "ranger phone number", so the LLM didn't pattern-match administrative queries to it. The fix was two-pronged: expand the docstring to explicitly enumerate every category of question the tool handles, and add a hard rule in the system prompt that `search_knowledge_base` must be called first for any specific factual question. Relying on the docstring alone wasn't sufficient — the system prompt rule is what actually changed the behavior.

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A LiveKit Cloud project (free tier works)
- API keys: OpenAI, Deepgram, ElevenLabs, Google (Places + Maps JS)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
OPENAI_API_KEY=your_openai_key
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
GOOGLE_PLACES_API_KEY=your_google_key
```

Build the vector store (run once, re-run when PDFs change):
```bash
python scripts/ingest.py
```

Start the agent:
```bash
python -m agent.main dev
```

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_maps_key
GOOGLE_PLACES_API_KEY=your_server_places_key
```

> `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is the browser-restricted key used to load Maps JS.  
> `GOOGLE_PLACES_API_KEY` is the unrestricted server key used by API routes for photo and weather proxying.  
> Both can be the same key if you haven't configured referrer restrictions.

Start the dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), allow microphone access, and tap "Start Call."

### 3. Adding PDFs to the Knowledge Base

Place PDF files in `backend/data/pdfs/` and re-run:
```bash
cd backend
python scripts/ingest.py
```

Then restart the agent. Image-only PDFs (maps with no extractable text) are automatically skipped.

---

## Project Structure

```
cliff/
├── backend/
│   ├── agent/
│   │   ├── main.py       # LiveKit entrypoint, session setup
│   │   ├── tools.py      # CliffAgent — all function tools
│   │   ├── prompts.py    # System prompt + personality
│   │   └── rag.py        # FAISS retriever loader
│   ├── scripts/
│   │   └── ingest.py     # PDF → FAISS ingestion
│   ├── data/pdfs/        # Source PDFs (add your documents here)
│   ├── vector_store/     # Built by ingest.py (gitignored)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx              # Root — layout orchestration
    │   │   └── api/
    │   │       ├── token/route.ts    # LiveKit token generation
    │   │       ├── weather/route.ts  # Google Weather proxy
    │   │       └── photo/route.ts    # Google Places Photo proxy
    │   ├── components/
    │   │   ├── ConnectedView.tsx     # LiveKit hooks, data channel listener
    │   │   ├── AgentPanel.tsx        # Orb + transcript container
    │   │   ├── LiveKitTranscript.tsx # Real-time transcript display
    │   │   ├── PlacesMap.tsx         # Full-screen map with markers
    │   │   ├── PlacesSidebar.tsx     # Place list + detail view
    │   │   ├── ControlDock.tsx       # Start/end/layout controls
    │   │   └── LandingHero.tsx       # First-load intro screen
    │   └── hooks/
    │       └── use-call-session.ts   # Token fetch, connection state
    └── package.json
```

---

## AI Tools Used

- **Claude Code** — development assistant throughout
- **GPT-4o** — Cliff's LLM (runtime)
- **OpenAI text-embedding-3-small** — RAG embeddings (ingestion + retrieval)
