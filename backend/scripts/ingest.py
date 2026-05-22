"""
Offline ingestion script — run once to build the FAISS vector store.
Usage (from backend/): python scripts/ingest.py
"""
from pathlib import Path

from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

load_dotenv()

PDF_DIR = Path(__file__).parent.parent / "data" / "pdfs"
VECTOR_STORE_PATH = Path(__file__).parent.parent / "vector_store"

# Map PDFs are image-only — skip pages with fewer than this many characters.
MIN_PAGE_CHARS = 100


def ingest():
    pdf_files = list(PDF_DIR.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {PDF_DIR}. Add PDFs and re-run.")
        return

    print(f"Found {len(pdf_files)} PDF(s)")

    docs = []
    for pdf in pdf_files:
        print(f"  Loading {pdf.name}...")
        loader = PyPDFLoader(str(pdf))
        pages = loader.load()
        useful = [p for p in pages if len(p.page_content.strip()) >= MIN_PAGE_CHARS]
        if useful:
            print(f"    {len(useful)}/{len(pages)} pages have text content")
        else:
            print(f"    Skipping — no text content (image-only PDF)")
        docs.extend(useful)

    if not docs:
        print("No text content found across all PDFs. Aborting.")
        return

    print(f"\nLoaded {len(docs)} pages with content. Splitting...")

    # chunk_size=1000 / overlap=200 keeps enough context that a single regulation
    # or trail description stays together; overlap ensures cross-chunk facts are retrieved.
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(docs)

    for chunk in chunks:
        chunk.metadata["document_tag"] = Path(chunk.metadata["source"]).stem

    print(f"Created {len(chunks)} chunks. Embedding with text-embedding-3-small...")

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    store = FAISS.from_documents(chunks, embeddings)

    VECTOR_STORE_PATH.mkdir(parents=True, exist_ok=True)
    store.save_local(str(VECTOR_STORE_PATH))
    print(f"\nVector store saved to {VECTOR_STORE_PATH}")


if __name__ == "__main__":
    ingest()
