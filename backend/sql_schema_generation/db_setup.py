"""
FAISS-based Schema Generation Database Setup
Converts data.pdf into searchable vector embeddings for schema generation
"""

import os
import sys
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SchemaVectorStore:
    """Handles FAISS vector store creation for schema generation"""
    
    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
        
        # Set up paths
        self.current_dir = Path(__file__).parent
        self.data_file = self.current_dir / "data.pdf"
        self.faiss_index_path = self.current_dir / "schema_faiss_index"
        
    def load_and_process_pdf(self):
        """Load and process the data.pdf file"""
        print(f"Loading PDF from: {self.data_file}")
        
        if not self.data_file.exists():
            raise FileNotFoundError(f"data.pdf not found at {self.data_file}")
        
        # Load PDF
        loader = PyPDFLoader(str(self.data_file))
        documents = loader.load()
        
        print(f"Loaded {len(documents)} pages from PDF")
        
        # Split documents into chunks
        chunks = self.text_splitter.split_documents(documents)
        print(f"Created {len(chunks)} chunks from PDF content")
        
        # Add metadata for schema-specific context
        for i, chunk in enumerate(chunks):
            chunk.metadata.update({
                'source': 'schema_data_pdf',
                'chunk_id': i,
                'content_type': 'schema_design'
            })
        
        return chunks
    
    def create_faiss_index(self, documents):
        """Create FAISS vector index from documents"""
        print("Creating FAISS vector index...")
        
        # Create vector store
        vector_store = FAISS.from_documents(documents, self.embeddings)
        
        # Save locally
        vector_store.save_local(str(self.faiss_index_path))
        
        print(f"FAISS index saved to: {self.faiss_index_path}")
        return vector_store
    
    def setup_complete_pipeline(self):
        """Complete setup pipeline for schema generation"""
        try:
            print("=== Schema Generation Vector Store Setup ===")
            
            # Load and process PDF
            documents = self.load_and_process_pdf()
            
            # Create FAISS index
            vector_store = self.create_faiss_index(documents)
            
            # Test retrieval
            test_query = "database schema design best practices"
            test_docs = vector_store.similarity_search(test_query, k=3)
            
            print(f"\n=== Test Retrieval ===")
            print(f"Query: {test_query}")
            print(f"Retrieved {len(test_docs)} documents")
            
            for i, doc in enumerate(test_docs):
                print(f"\nDoc {i+1}:")
                print(f"Content preview: {doc.page_content[:200]}...")
                print(f"Source: {doc.metadata.get('source', 'unknown')}")
            
            print("\n✅ Schema generation vector store setup completed successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error during setup: {str(e)}")
            return False

def main():
    """Main setup function"""
    setup = SchemaVectorStore()
    success = setup.setup_complete_pipeline()
    
    if success:
        print("\n🎯 Next steps:")
        print("1. Run schema_generator.py to test schema generation")
        print("2. Start main_api.py for the Flask API server")
        print("3. Test with schema generation requests")
    else:
        print("\n❌ Setup failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()