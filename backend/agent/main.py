import json
import logging
import os

from dotenv import load_dotenv
from livekit.agents import AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, elevenlabs, openai, silero

from .prompts import build_system_prompt
from .rag import create_rag_retriever
from .tools import CliffAgent

load_dotenv()
logger = logging.getLogger("cliff-agent")


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    user_location: str | None = None
    for participant in ctx.room.remote_participants.values():
        if participant.metadata:
            try:
                meta = json.loads(participant.metadata)
                user_location = meta.get("location")
            except (json.JSONDecodeError, AttributeError):
                pass

    retriever = create_rag_retriever()
    agent = CliffAgent(
        instructions=build_system_prompt(user_location),
        retriever=retriever,
        room=ctx.room,
    )

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
        instructions="Say exactly: G'day mate, what adventure are we planning today?"
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
