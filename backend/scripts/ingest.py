"""
Offline ingestion script — run once to build the FAISS vector store.
Usage: python scripts/ingest.py
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

load_dotenv()

PDF_DIR = Path(__file__).parent.parent / "data" / "pdfs"
VECTOR_STORE_PATH = Path(__file__).parent.parent / "vector_store"


def ingest():
    pdf_files = list(PDF_DIR.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {PDF_DIR}. Add PDFs and re-run.")
        return

    print(f"Found {len(pdf_files)} PDF(s): {[f.name for f in pdf_files]}")

    docs = []
    for pdf in pdf_files:
        print(f"  Loading {pdf.name}...")
        loader = PyPDFLoader(str(pdf))
        docs.extend(loader.load())

    print(f"Loaded {len(docs)} pages total. Splitting...")

    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    chunks = splitter.split_documents(docs)
    print(f"Created {len(chunks)} chunks. Embedding...")

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    store = FAISS.from_documents(chunks, embeddings)

    VECTOR_STORE_PATH.mkdir(parents=True, exist_ok=True)
    store.save_local(str(VECTOR_STORE_PATH))
    print(f"Vector store saved to {VECTOR_STORE_PATH}")


if __name__ == "__main__":
    ingest()
