"""
FAISS-based Schema Generator
Generates database schemas using RAG with FAISS vector store
"""

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from groq import Groq
import cohere
from pathlib import Path
import os
from typing import List, Dict, Any
from dotenv import load_dotenv
import time
import logging
from analytics import schema_analytics

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SchemaGenerator:
    """Generates database schemas using FAISS RAG and Groq LLM"""
    
    def __init__(self):
        # Initialize API clients
        self.groq_client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        self.cohere_client = cohere.Client(os.getenv('COHERE_API_KEY'))
        
        # Initialize embeddings
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # Set up paths
        self.current_dir = Path(__file__).parent
        self.faiss_index_path = self.current_dir / "schema_faiss_index"
        
        # Load vector store
        self.vector_store = None
        self.load_vector_store()
    
    def load_vector_store(self):
        """Load the FAISS vector store"""
        try:
            if self.faiss_index_path.exists():
                self.vector_store = FAISS.load_local(
                    str(self.faiss_index_path),
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                logger.info("✅ Schema FAISS vector store loaded successfully")
            else:
                logger.error(f"❌ FAISS index not found at {self.faiss_index_path}")
                logger.info("💡 Run db_setup.py first to create the vector store")
                
        except Exception as e:
            logger.error(f"❌ Error loading vector store: {str(e)}")
    
    def retrieve_relevant_docs(self, query: str, k: int = 5) -> List[Any]:
        """Retrieve relevant documents from FAISS"""
        if not self.vector_store:
            return []
        
        try:
            docs = self.vector_store.similarity_search(query, k=k)
            logger.info(f"Retrieved {len(docs)} documents for query: {query}")
            return docs
        except Exception as e:
            logger.error(f"Error retrieving documents: {str(e)}")
            return []
    
    def rerank_documents(self, query: str, documents: List[Any], top_n: int = 3) -> List[Any]:
        """Rerank documents using Cohere for better relevance"""
        if not documents:
            return []
        
        try:
            # Try different reranking models with fallback
            rerank_models = [
                "rerank-english-v3.0",
                "rerank-english-v2.0", 
                "rerank-multilingual-v3.0"
            ]
            
            for model in rerank_models:
                try:
                    reranked = self.cohere_client.rerank(
                        model=model,
                        query=query,
                        documents=[doc.page_content for doc in documents],
                        top_n=top_n
                    )
                    
                    # Return reranked documents
                    reranked_docs = []
                    for result in reranked.results:
                        reranked_docs.append(documents[result.index])
                    
                    logger.info(f"✅ Reranked documents using {model}")
                    return reranked_docs
                    
                except Exception as e:
                    logger.warning(f"Reranking failed with {model}: {str(e)}")
                    continue
            
            # Fallback to original documents
            logger.info("Using original document order as fallback")
            return documents[:top_n]
            
        except Exception as e:
            logger.error(f"Error in reranking: {str(e)}")
            return documents[:top_n]
    
    def generate_schema(self, requirements: str) -> Dict[str, Any]:
        """Generate database schema based on requirements"""
        start_time = time.time()
        
        try:
            # Retrieve relevant documents
            docs = self.retrieve_relevant_docs(requirements, k=5)
            
            if not docs:
                return {
                    "success": False,
                    "error": "No relevant documentation found. Please run db_setup.py first.",
                    "schema": None,
                    "explanation": None
                }
            
            # Rerank documents
            reranked_docs = self.rerank_documents(requirements, docs, top_n=3)
            
            # Prepare context
            context = "\n\n".join([doc.page_content for doc in reranked_docs])
            
            # Create prompt for schema generation
            prompt = self.create_schema_prompt(requirements, context)
            
            # Generate schema using Groq
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert database architect specializing in schema design and optimization.
                        
Your responses should be:
1. Technically accurate and follow database best practices
2. Include proper data types, constraints, and indexing strategies
3. Consider performance, scalability, and maintainability
4. Provide clear explanations for design decisions

Format your response as:
[SCHEMA]
<DDL statements>
[EXPLANATION]
<Design rationale and best practices>
[OPTIMIZATIONS]
<Performance recommendations>"""
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            # Parse response
            content = response.choices[0].message.content
            schema, explanation, optimizations = self.parse_schema_response(content)
            
            end_time = time.time()
            response_time = end_time - start_time
            
            # Log analytics
            try:
                schema_id = schema_analytics.log_schema_generation(
                    requirements=requirements,
                    schema_content=schema,
                    explanation=explanation,
                    optimizations=optimizations,
                    response_time=response_time,
                    docs_retrieved=len(docs),
                    docs_used=len(reranked_docs),
                    success=True,
                    reranking_model="rerank-english-v3.0",
                    llm_model="llama-3.3-70b-versatile"
                )
                logger.info(f"Analytics logged for schema ID: {schema_id}")
            except Exception as analytics_error:
                logger.warning(f"Failed to log analytics: {analytics_error}")
            
            return {
                "success": True,
                "schema": schema,
                "explanation": explanation,
                "optimizations": optimizations,
                "response_time": response_time,
                "docs_retrieved": len(docs),
                "docs_used": len(reranked_docs)
            }
            
        except Exception as e:
            logger.error(f"Error generating schema: {str(e)}")
            
            # Log failed generation
            try:
                schema_analytics.log_schema_generation(
                    requirements=requirements,
                    schema_content="",
                    explanation="",
                    optimizations="",
                    response_time=time.time() - start_time,
                    docs_retrieved=len(docs) if 'docs' in locals() else 0,
                    docs_used=0,
                    success=False,
                    error_message=str(e)
                )
            except Exception as analytics_error:
                logger.warning(f"Failed to log error analytics: {analytics_error}")
            
            return {
                "success": False,
                "error": str(e),
                "schema": None,
                "explanation": None
            }
    
    def create_schema_prompt(self, requirements: str, context: str) -> str:
        """Create prompt for schema generation"""
        return f"""Based on the following database design documentation:

{context}

Requirements: {requirements}

Please design an optimal database schema including:
1. CREATE TABLE statements with appropriate data types
2. Primary keys, foreign keys, and constraints
3. Indexing strategies for performance
4. Partitioning recommendations if applicable
5. Best practices for the given requirements

Focus on performance, scalability, and maintainability."""
    
    def parse_schema_response(self, content: str) -> tuple:
        """Parse the LLM response into schema, explanation, and optimizations"""
        try:
            schema = ""
            explanation = ""
            optimizations = ""
            
            if "[SCHEMA]" in content:
                parts = content.split("[SCHEMA]", 1)
                if len(parts) > 1:
                    remaining = parts[1]
                    
                    if "[EXPLANATION]" in remaining:
                        schema_part, rest = remaining.split("[EXPLANATION]", 1)
                        schema = schema_part.strip()
                        
                        if "[OPTIMIZATIONS]" in rest:
                            explanation_part, opt_part = rest.split("[OPTIMIZATIONS]", 1)
                            explanation = explanation_part.strip()
                            optimizations = opt_part.strip()
                        else:
                            explanation = rest.strip()
                    else:
                        schema = remaining.strip()
            else:
                # Fallback: use entire content as schema
                schema = content.strip()
            
            return schema, explanation, optimizations
            
        except Exception as e:
            logger.error(f"Error parsing response: {str(e)}")
            return content.strip(), "", ""

def main():
    """Test the schema generator"""
    generator = SchemaGenerator()
    
    # Test schema generation
    test_requirements = """
    Design a database schema for an e-commerce platform that needs to handle:
    - User accounts and authentication
    - Product catalog with categories and inventory
    - Shopping cart and order management
    - Payment processing and transaction history
    - Customer reviews and ratings
    
    The system should support high read/write volume and be optimized for performance.
    """
    
    print("🔧 Testing Schema Generation...")
    print(f"Requirements: {test_requirements}")
    print("\n" + "="*50)
    
    result = generator.generate_schema(test_requirements)
    
    if result["success"]:
        print("✅ Schema Generation Successful!")
        print(f"⏱️ Response Time: {result['response_time']:.2f} seconds")
        print(f"📄 Documents Retrieved: {result['docs_retrieved']}")
        print(f"🎯 Documents Used: {result['docs_used']}")
        
        print("\n🗄️ Generated Schema:")
        print("-" * 40)
        print(result["schema"])
        
        if result["explanation"]:
            print("\n📝 Explanation:")
            print("-" * 40)
            print(result["explanation"])
        
        if result["optimizations"]:
            print("\n⚡ Optimizations:")
            print("-" * 40)
            print(result["optimizations"])
            
    else:
        print("❌ Schema Generation Failed!")
        print(f"Error: {result['error']}")

if __name__ == "__main__":
    main()