import logging
import os

from dotenv import load_dotenv
from livekit.agents import AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, elevenlabs, openai, silero

from .rag import create_rag_retriever
from .tools import CliffAgent

load_dotenv()
logger = logging.getLogger("cliff-agent")


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    retriever = create_rag_retriever()
    agent = CliffAgent(retriever=retriever)

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-2"),
        llm=openai.LLM(model="gpt-4o"),
        tts=elevenlabs.TTS(
            api_key=os.environ["ELEVENLABS_API_KEY"],
            voice_id=os.environ["ELEVENLABS_VOICE_ID"],
        ),
    )

    await session.start(room=ctx.room, agent=agent)
    await session.generate_reply(
        instructions="Greet the user as Cliff. One or two sentences max, keep it punchy. No emojis."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
