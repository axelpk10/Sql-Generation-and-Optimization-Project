"""
FAISS-based document ingestion for Trino documentation
This approach uses local embeddings to avoid API issues with Weaviate + HuggingFace
"""

import logging
import os
from pathlib import Path
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import TextLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrinoFAISSIngestor:
    """FAISS-based ingestion system for Trino documentation"""
    
    def __init__(self, data_dir="data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.faiss_index_path = self.data_dir / "faiss_index"
        
        # Initialize embeddings
        logger.info("Initializing HuggingFace embeddings...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # Initialize text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
    
    def load_documents(self, file_paths):
        """Load documents from multiple file paths"""
        all_documents = []
        
        for file_path in file_paths:
            try:
                logger.info(f"Loading document: {file_path}")
                loader = TextLoader(file_path=file_path, encoding='utf-8')
                documents = loader.load()
                
                # Add metadata to identify source
                for doc in documents:
                    doc.metadata['source_file'] = os.path.basename(file_path)
                
                all_documents.extend(documents)
                logger.info(f"Loaded {len(documents)} documents from {file_path}")
                
            except Exception as e:
                logger.error(f"Error loading {file_path}: {e}")
                continue
        
        return all_documents
    
    def chunk_documents(self, documents):
        """Split documents into chunks"""
        logger.info("Splitting documents into chunks...")
        chunks = self.text_splitter.split_documents(documents)
        logger.info(f"Created {len(chunks)} chunks")
        
        # Log sample chunks
        for i, chunk in enumerate(chunks[:3]):
            logger.info(f"Sample chunk {i+1} (first 200 chars):\n{chunk.page_content[:200]}...\n")
        
        return chunks
    
    def create_faiss_index(self, documents):
        """Create FAISS vector store from documents"""
        try:
            logger.info("Creating FAISS vector store...")
            vector_store = FAISS.from_documents(documents, self.embeddings)
            
            # Save the index
            vector_store.save_local(str(self.faiss_index_path))
            logger.info(f"FAISS index saved to {self.faiss_index_path}")
            
            return vector_store
            
        except Exception as e:
            logger.error(f"Error creating FAISS index: {e}")
            raise
    
    def load_existing_index(self):
        """Load existing FAISS index if available"""
        try:
            if self.faiss_index_path.exists():
                logger.info(f"Loading existing FAISS index from {self.faiss_index_path}")
                vector_store = FAISS.load_local(
                    str(self.faiss_index_path),
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                logger.info("FAISS index loaded successfully!")
                return vector_store
            else:
                logger.info("No existing FAISS index found")
                return None
        except Exception as e:
            logger.error(f"Error loading FAISS index: {e}")
            return None
    
    def ingest_trino_docs(self, force_rebuild=False):
        """Main ingestion method"""
        # Check if index already exists
        if not force_rebuild:
            existing_index = self.load_existing_index()
            if existing_index:
                logger.info("Using existing FAISS index")
                return existing_index
        
        # Define document paths
        current_dir = Path(__file__).parent
        document_paths = [
            current_dir / "trino_data.md",
            current_dir / "trino_documentation.md"
        ]
        
        # Check if files exist
        existing_paths = [path for path in document_paths if path.exists()]
        if not existing_paths:
            logger.error(f"No document files found in {current_dir}")
            return None
        
        # Load and process documents
        documents = self.load_documents(existing_paths)
        if not documents:
            logger.error("No documents loaded")
            return None
        
        # Chunk documents
        chunks = self.chunk_documents(documents)
        
        # Create FAISS index
        vector_store = self.create_faiss_index(chunks)
        
        logger.info(f"Successfully ingested {len(chunks)} chunks into FAISS")
        return vector_store
    
    def test_retrieval(self, vector_store, query="What is Trino?", k=3):
        """Test document retrieval"""
        if not vector_store:
            logger.error("No vector store available for testing")
            return
        
        logger.info(f"Testing retrieval with query: '{query}'")
        try:
            retriever = vector_store.as_retriever(search_kwargs={"k": k})
            docs = retriever.get_relevant_documents(query)
            
            logger.info(f"Retrieved {len(docs)} documents:")
            for i, doc in enumerate(docs):
                logger.info(f"Document {i+1}:")
                logger.info(f"Source: {doc.metadata.get('source_file', 'Unknown')}")
                logger.info(f"Content preview: {doc.page_content[:200]}...")
                logger.info("-" * 50)
                
        except Exception as e:
            logger.error(f"Error during retrieval test: {e}")


def main():
    """Main execution function"""
    logger.info("Starting FAISS ingestion for Trino documentation")
    
    ingestor = TrinoFAISSIngestor()
    
    # Ingest documents
    vector_store = ingestor.ingest_trino_docs(force_rebuild=True)
    
    if vector_store:
        # Test retrieval
        ingestor.test_retrieval(vector_store, "How to optimize Trino queries?")
        logger.info("Ingestion completed successfully!")
    else:
        logger.error("Ingestion failed!")


if __name__ == "__main__":
    main()