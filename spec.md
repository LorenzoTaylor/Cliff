This is a takehome assesment for a software position

Build a RAG-enabled voice agent using LiveKit Cloud to solve a personal problem, featuring real-time speech transcription and a creative narrative. The agent should retrieve information from a relevant PDF and answer questions in real-time. Deliverables include a Git repository with full application code, a design document, and setup instructions, with bonus points for AWS deployment.

## Overview

Build a RAG-enabled voice agent that solves a personal problem in your life. Use **LiveKit Cloud** for hosting the server.

## Objectives

- Create a voice agent with LiveKit that you can converse with on a custom (simple) frontend.
- Transcribe speech in real time, and maintain a live transcript.
- Give your agent a personality, **spin a story**. Be creative. **Put time into this part!** I will consider the creativity / story-telling to be your behavioral!
- In the call, **make a tool call of your choice** that fits in with the narrative of your voice agent.
    - EX: If you are building a basketball coach voice agent, tool call could be a list of nearby courts.
- Use RAG to enable your voice agent to answer a question from a large PDF document related to your story
    - EX: If you are building a basketball coach voice agent, use a PDF of a book on Steve Kerr to have your voice agent give advice on optimal OT strategies.
- You must deploy your Agent on **Vercel/AWS** instead of running it locally.

## Technical Requirements

### 1. [Backend] LiveKit Setup

- Deploy a LiveKit server or use LiveKit Cloud for server hosting.
- Build a LiveKit Agent that is capable of joining the room and having a live conversation with the user about a topic of your choice.
- The LiveKit agent can either be hosted locally or on AWS (bonus points for AWS).
- Use a voice agent pipeline with configurable STT, LLM, TTS, VAD.

### 2. [Backend] RAG Over Uploaded PDF

- Enable your voice agent to retrieve information from a large PDF of your choosing. Ensure the PDF is relevant to your overall voice agent story.
- Once uploaded, your agent should be able to **run Retrieval-Augmented Generation (RAG)** over the content of the PDF and answer questions about it **in real-time voice conversation**.
- I will ask about a **specific fact in a specific chapter**, so a proper RAG setup is essential — not just keyword search or summarization.
- You are **encouraged to use an existing RAG framework** (like LangChain, LlamaIndex, or OpenAI's retrieval tools) instead of building a vector store from scratch.
- This documentation will help you integrate the RAG system into your LiveKit Agent: [LiveKit Agents + External Data (Docs)](https://docs.livekit.io/agents/build/external-data/)

### 3. [Frontend] Chat Interface with Real-Time Transcription

- Build a **React-based client** with:
    - “Start Call” button.
    - **Live transcript** display that updates as participants speak.
    - “End Call” button.
    - Optionally, add a **PDF upload button** to the frontend *if* it fits your UX flow. No points lost if this feature is not there.

## Constraints

- Must use **LiveKit**.
- Use any AI tools you need/want, just document them.

## Deliverables

Submit a single **Git repository** containing:

1. **Vercel Deployment Link**
    1. A link to a fully deployed agent for the team to test!
2. **Full Application Code**
    - LiveKit Python backend (including RAG logic).
    - React frontend.
    - Vector store.
3. [**README.md**](http://readme.md/)
    - A short **design document** explaining:
        - How your system works end-to-end.
        - How RAG was integrated.
        - The tools/frameworks used.
    - **Setup instructions** to run the project locally or on the web.
4. **Design Decisions / Assumptions**
    - Describe:
        - Any trade-offs or limitations.
        - Hosting assumptions.
        - RAG assumptions (e.g., vector DB choice, chunking strategy, frameworks).
        - LiveKit agent design.

## Submission

- Send a YouTube link presenting your take-home, including a code walkthrough covering:
    - Room token generation
    - Tool calls
    - RAG setup
    - RAG trade-offs
- Keep the video to **5 minutes or less**