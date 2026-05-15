# Cliff

Cliff is a voice agent for Bay Area outdoor stuff. Ask where to go hiking, fishing, or climbing and it finds spots, checks weather and fire conditions, and looks up regulatory details from actual park documents.

**Live demo:** https://cliff-puce.vercel.app

---

## How it works

```
User speaks → Deepgram STT → GPT-4o (with tools) → ElevenLabs TTS → User hears
```

The frontend is Next.js. Hitting "Start Call" fetches a short-lived LiveKit token from `/api/token`, with your GPS coordinates encoded in the participant metadata. The Python agent joins the same room, reads those coordinates on join, and uses them as the default location for every tool call. No "where are you?" turn.

The agent has four tools:

| Tool | What it does | Source |
|------|-------------|--------|
| `get_weather` | Current conditions for a location | Google Weather API |
| `get_fire_and_closures` | Active fire incidents within 80 km | NIFC WFIGS ArcGIS (public, no key) |
| `find_nearby_spots` | Trails, crags, lakes, OHV areas near a location | Google Places API |
| `search_knowledge_base` | Regulations, contacts, permits from park PDFs | FAISS vector store |

When `find_nearby_spots` fires, the agent also pushes structured place data (names, coordinates, photo references) into the LiveKit room over a DataChannel. The frontend is subscribed and renders map pins and a detail sidebar when that data arrives.

---

## RAG

The knowledge base is a collection of Bay Area park PDFs — trail guides, ranger district references, fishing and hunting regulations — in `backend/data/pdfs/`.

Ingestion (`backend/scripts/ingest.py`):
1. Loads every PDF with `PyPDFLoader`
2. Skips image-only pages (under 100 chars of extractable text)
3. Splits into chunks of 1000 chars, 200 overlap
4. Embeds with `text-embedding-3-small`
5. Saves a FAISS index to `backend/vector_store/`

At startup the agent loads that index and retrieves the 6 closest chunks per query. If the vector store isn't there, it falls back to a no-op and RAG is disabled.

---

## Stack

Backend: LiveKit Agents, Silero VAD, Deepgram Nova-2 (STT), GPT-4o, ElevenLabs (TTS), LangChain, FAISS, httpx

Frontend: Next.js (App Router), @livekit/components-react, @vis.gl/react-google-maps, Tailwind, shadcn/ui

AI tools used during development: Claude Code, GPT-4o (also Cliff's runtime LLM), text-embedding-3-small (RAG embeddings)

---

## Setup

Requirements: Python 3.11+, Node 18+, a LiveKit Cloud project (free tier works), API keys for OpenAI, Deepgram, ElevenLabs, and Google.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

`backend/.env`:
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
OPENAI_API_KEY=...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
GOOGLE_PLACES_API_KEY=...
```

Build the vector store (once, re-run after adding PDFs):
```bash
python scripts/ingest.py
```

Start the agent:
```bash
python -m agent.main dev
```

### Frontend

```bash
cd frontend && npm install
```

`frontend/.env.local`:
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_key
GOOGLE_PLACES_API_KEY=your_server_key
```

The two Google keys can be the same if you haven't set referrer restrictions. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` loads Maps JS in the browser. `GOOGLE_PLACES_API_KEY` is used server-side by the Next.js API routes for photo and weather proxying, so it doesn't need referrer restrictions.

```bash
npm run dev
```

Open http://localhost:3000, allow mic access, hit Start Call.

### Adding PDFs

Drop files into `backend/data/pdfs/` and re-run:
```bash
cd backend && python scripts/ingest.py
```

Restart the agent after. Image-only PDFs (maps with no extractable text) are skipped automatically.
