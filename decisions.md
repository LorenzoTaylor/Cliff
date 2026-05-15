# Design decisions

![](assets/decisions-header.jpg)

## RAG

**Vector store: FAISS on disk**

Bay Area park docs don't change between sessions, so Pinecone or pgvector would be overkill. FAISS saves to disk, loads fast, no network dependency. Downside: adding PDFs means re-running `ingest.py` and redeploying. Fine for a curated static set.

**Embeddings: text-embedding-3-small**

text-embedding-3-large would improve retrieval marginally but costs 5x more per token. On a document set this small, the difference isn't worth it.

**Chunking: 1000 chars, 200 overlap**

Started at 800/100. Bumped up after some regulations and trail descriptions were getting cut mid-sentence. The 200-char overlap hedges against facts straddling a chunk boundary. Going much larger (2000+) hurts precision. A chunk about trail fees scores lower on a ranger contact query when it's buried in 2000 chars of unrelated content.

**k=6**

The default k=4 missed answers that were present but ranked 5th or 6th by similarity. k=6 fixed several cases where the agent deflected instead of answering. Too high (k=15+) and the LLM starts getting confused by text that's related but not relevant.

**LangChain**

Used for document loaders, text splitter, and FAISS wrapper. Honestly more than needed. The same thing could be written in a few dozen lines without it. Kept it because the ingestion script was quick to write and the retriever interface is clean enough.

**Image-only PDFs**

Several Bay Area park PDFs are map scans with no extractable text. Pages under 100 chars get filtered at ingestion. OCR would recover some content but adds real complexity (Tesseract or a vision model pass) for uncertain gains. The most useful content is in text PDFs anyway.

---

## LiveKit agent design

Standard pipeline: Silero VAD detects voice activity, Deepgram Nova-2 transcribes, GPT-4o responds with optional tool calls, ElevenLabs speaks it back. `CliffAgent` extends the LiveKit `Agent` base class with tools defined as decorated async methods.

**STT: Deepgram Nova-2**, native LiveKit plugin, lowest latency of the supported options.

**TTS: ElevenLabs**, good voice quality. Cartesia Sonic is a reasonable fallback if ElevenLabs latency becomes an issue.

**LLM: GPT-4o**, chosen for reliable function-calling. Smaller models (GPT-4o-mini) are cheaper and faster but less consistent about following the system prompt rules around tool routing and persona. Worth revisiting once the prompts are locked in.

**Location from participant metadata**

GPS coordinates get encoded into the LiveKit token at generation time. The agent reads them on room join and has the user's location before the first word is spoken. Limitation: location is snapshotted at call start. If the user is driving to a trailhead mid-call, it won't update.

**Tool routing**

GPT-4o routes based heavily on docstring content, more than expected. Asking "who is the region manager for Bay Region 3" would hit trail recommendations instead of the knowledge base because the `search_knowledge_base` docstring had narrow examples. Fix: broader docstring enumerating all query types, plus a system prompt rule to always call `search_knowledge_base` first for factual questions. The docstring change alone wasn't enough.

**DataChannel for place data**

When `find_nearby_spots` fires, place data goes into the LiveKit room over a DataChannel instead of a separate HTTP call. The frontend is already subscribed, so it arrives with no polling. The map only updates when the agent fires the tool, but since that's always in response to what the user asked, it hasn't been an issue.

---

## Geographic scope

Bay Area only, intentionally. Smaller geography = smaller, more curated document set = better retrieval. A national scope would've meant a massive knowledge base and worse answers on every specific question.

---

## Scope cuts

- PDF upload from the frontend: not needed, PDFs are pre-ingested at build time
- OCR on image-only PDFs: complexity not worth it for this document set
- Location updates mid-call: coordinates are snapshotted at call start
