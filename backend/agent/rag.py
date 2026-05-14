import logging
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

logger = logging.getLogger("cliff-agent")

VECTOR_STORE_PATH = Path(__file__).parent.parent / "vector_store"


class _NullRetriever:
    def invoke(self, query: str):
        return []


def create_rag_retriever(k: int = 4):
    """Load the pre-built FAISS index and return a retriever.

    Falls back to a no-op retriever if the vector store hasn't been built yet.
    Run `python scripts/ingest.py` to build it.
    """
    if not VECTOR_STORE_PATH.exists():
        logger.warning(
            "Vector store not found at %s — RAG disabled. "
            "Run `python scripts/ingest.py` to enable it.",
            VECTOR_STORE_PATH,
        )
        return _NullRetriever()

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    store = FAISS.load_local(
        str(VECTOR_STORE_PATH),
        embeddings,
        allow_dangerous_deserialization=True,
    )
    return store.as_retriever(search_kwargs={"k": k})
