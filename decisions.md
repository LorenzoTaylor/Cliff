# Cliff – Decision Log

## Agent Concept
- **Persona**: Steve Irwin-style outdoor enthusiast named Cliff
- **Scope**: Bay Area only (keeps tool results accurate and relevant)
- **Activities**: hiking, fishing, hunting, biking, dirtbiking, climbing

---

## RAG Corpus (multi-PDF)
- Multiple PDFs ingested into a single vector store
- Target docs: Bay Area spot guides, ranger station contacts, seasonal closures/advisories, activity rules per district
- Sources to include: MROSD trail guides, EBRPD district guides, Mt. Tam / Point Reyes / GGNRA PDFs, CA CDFW hunting & fishing regs, USFS Bay Area ranger district handbooks, CAL FIRE seasonal closure docs
- **Tradeoff**: More PDFs = richer answers but longer ingestion time and larger index; acceptable for MVP since ingestion is offline
- **Tutorial reference**: https://www.youtube.com/watch?v=SPB2T-eLrOg&list=PLWx-Xa8RhJxXuv8fu2Qz9rj2MPb4qgXir&index=2

## RAG Framework
- **Choice**: LangChain + FAISS
- **Why**: No external infra needed, ships as files in repo, fast enough for voice latency
- **Tradeoff**: FAISS is in-memory/file-based — won't scale beyond demo, but fine for MVP

## Embeddings
- **Choice**: OpenAI `text-embedding-3-small`
- **Why**: Fast, cheap, pairs well with GPT-4o

## LLM
- **Choice**: GPT-4o ✅

## STT
- **Choice**: Deepgram Nova-2 (LiveKit native plugin, lowest STT latency)

## TTS
- **Choice**: ElevenLabs (user has credits) — fallback to Cartesia Sonic if latency is too high ✅

## VAD
- **Choice**: Silero (LiveKit default)

## Transport
- **Choice**: WebRTC via LiveKit ✅

## Tool Calls (real-time)
1. **Weather** — current conditions for a Bay Area location (OpenWeatherMap API)
2. **Fire & closure status** — active fire perimeters + trail closures for a Bay Area location (CAL FIRE / USFS ArcGIS)
3. **Nearby spots/trailheads** — Google Places API ("hiking trails near [location]"), ~200–400ms, costs per call
   - **Tradeoff**: Small cost per call, results depend on Google's POI data quality; acceptable for MVP/demo volume

## Frontend
- **Stack**: React + LiveKit React SDK (WebRTC/room logic) + ElevenLabs SDK components (voice UI) + Tailwind + shadcn/ui on Radix UI
- **Note**: ElevenLabs components used for UI only — NOT their LiveKit integration. LiveKit SDK owns the WebRTC transport.
- **Tradeoff**: Two SDKs in the frontend, but ElevenLabs components are preferred for voice-specific UI elements

## Deployment
- **Frontend**: Vercel ✅
- **Backend agent**: AWS (EC2 or ECS) ✅
- **LiveKit server**: LiveKit Cloud (managed)

## Latency Targets (tracked in latency.md)
| Stage | Target |
|-------|--------|
| VAD   | ~0ms (streaming) |
| STT (Deepgram Nova-2) | ~200–300ms |
| LLM (GPT-4o) | ~500–800ms TTFT |
| TTS (ElevenLabs) | ~400–700ms |
| **End-to-end** | **~1.2–1.8s** |

## Scope Cuts (MVP)
- Map directions: stretch goal
- Photos: stretch goal
- PDF upload from frontend: not needed, PDFs pre-ingested at build time
