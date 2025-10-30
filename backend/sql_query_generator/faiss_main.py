"""
FAISS-based SQL Query Generator for Trino
Main application using FAISS vector store for document retrieval
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_community.vectorstores import FAISS
from groq import Groq
from langchain_cohere import CohereRerank  # Updated import
from langchain.retrievers import ContextualCompressionRetriever
from langchain_huggingface import HuggingFaceEmbeddings
import os
import re
import time
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

# Get API keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")
if not COHERE_API_KEY:
    raise ValueError("COHERE_API_KEY not found in environment variables")

# Initialize clients
clientg = Groq(api_key=GROQ_API_KEY)

# Initialize FAISS vector store
try:
    print("Loading FAISS index...")
    current_dir = Path(__file__).parent
    faiss_index_path = current_dir / "data" / "faiss_index"
    
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    
    faiss_index = FAISS.load_local(
        str(faiss_index_path),
        embeddings,
        allow_dangerous_deserialization=True
    )
    print("FAISS index successfully loaded!")
    
    # Set up FAISS retriever
    retriever = faiss_index.as_retriever(
        search_kwargs={"k": 5}  # Retrieve top 5 similar documents
    )
    
    # Contextual Compression with Cohere (with proper error handling)
    try:
        # Try the current model names
        compressor = CohereRerank(
            cohere_api_key=COHERE_API_KEY,
            model="rerank-english-v3.0"
        )
        compression_retriever = ContextualCompressionRetriever(
            base_compressor=compressor,
            base_retriever=retriever
        )
        print("✅ Cohere reranking enabled with rerank-english-v3.0")
    except Exception as e1:
        try:
            # Try legacy model name
            compressor = CohereRerank(
                cohere_api_key=COHERE_API_KEY,
                model="rerank-english-v2.0"
            )
            compression_retriever = ContextualCompressionRetriever(
                base_compressor=compressor,
                base_retriever=retriever
            )
            print("✅ Cohere reranking enabled with rerank-english-v2.0")
        except Exception as e2:
            try:
                # Try with just the base model name
                compressor = CohereRerank(
                    cohere_api_key=COHERE_API_KEY,
                    model="rerank-multilingual-v3.0"
                )
                compression_retriever = ContextualCompressionRetriever(
                    base_compressor=compressor,
                    base_retriever=retriever
                )
                print("✅ Cohere reranking enabled with rerank-multilingual-v3.0")
            except Exception as e3:
                try:
                    # Try default model
                    compressor = CohereRerank(cohere_api_key=COHERE_API_KEY)
                    compression_retriever = ContextualCompressionRetriever(
                        base_compressor=compressor,
                        base_retriever=retriever
                    )
                    print("✅ Cohere reranking enabled with default model")
                except Exception as e4:
                    print(f"❌ All Cohere reranking attempts failed:")
                    print(f"  rerank-english-v3.0: {str(e1)[:100]}...")
                    print(f"  rerank-english-v2.0: {str(e2)[:100]}...")
                    print(f"  rerank-multilingual-v3.0: {str(e3)[:100]}...")
                    print(f"  default model: {str(e4)[:100]}...")
                    print("⚠️  Using basic FAISS retrieval without reranking")
                    compression_retriever = retriever
    
except Exception as e:
    print(f"Error loading FAISS index: {str(e)}")
    compression_retriever = None

def get_trino_query_template():
    """Template for Trino SQL query generation"""
    return """
    You are an expert Trino SQL developer. Your task is to generate optimized Trino SQL queries 
    that are syntactically correct, efficient, and follow Trino best practices.
    
    The query should be valid Trino SQL syntax and should use Trino specific functions.
    
    Given the following:
    User Question: {user_query}
    Context from Documentation: {context}
    
    Please provide:
    1. A detailed Trino SQL query that addresses the user's question
    2. An explanation of the query components
    3. Any relevant Trino-specific optimizations or best practices
    
    Consider:
    - Trino's distributed query execution
    - Appropriate use of Trino's supported data types
    - Partition pruning and predicate pushdown
    - Proper join strategies
    - Performance optimization techniques
    
    Format your response as:
    QUERY:
    <the SQL query>
    
    EXPLANATION:
    <detailed explanation>
    
    OPTIMIZATIONS:
    <list of Trino-specific optimizations>
    """

def generate_trino_query(user_query, context):
    """Generate a Trino-specific SQL query based on user input and context."""
    try:
        chat_completion = clientg.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior Trino SQL expert with deep knowledge of "
                              "distributed query optimization, performance tuning, and best practices."
                },
                {
                    "role": "user",
                    "content": get_trino_query_template().format(
                        user_query=user_query,
                        context=context
                    )
                }
            ],
            model="llama-3.3-70b-versatile",
            max_tokens=2000,
            temperature=0.3  # Lower temperature for more focused SQL generation
        )
        
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        return f"Error generating query: {str(e)}"

def get_trino_best_practices(user_query):
    """Get Trino-specific best practices based on the query."""
    try:
        chat_completion = clientg.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a Trino expert focusing on query optimization and best practices. "
                              "Provide concise, actionable recommendations."
                },
                {
                    "role": "user",
                    "content": f"""
                    Based on this query: '{user_query}', provide Trino-specific best practices considering:
                    - Connector optimization
                    - Query optimization
                    - Resource management
                    - Performance tuning
                    - Data distribution
                    
                    Only include Trino-specific recommendations that are relevant.
                    """
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.4
        )
        
        return clean_text(chat_completion.choices[0].message.content)
        
    except Exception as e:
        return f"Error getting best practices: {str(e)}"

def clean_text(text):
    """Clean and format text response."""
    # Remove code blocks
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    # Normalize spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def process_query(user_query):
    """Process the user query and return relevant Trino information."""
    if compression_retriever is None:
        return {
            "error": "FAISS retriever not available. Check server logs for details."
        }
    
    try:
        # Get Trino best practices
        trino_practices = get_trino_best_practices(user_query)
        
        # Retrieve relevant documentation using FAISS + Cohere reranking
        retrieved_docs = compression_retriever.get_relevant_documents(user_query)
        doc_context = "\n\n".join(doc.page_content for doc in retrieved_docs)
        
        # Generate Trino query
        trino_query = generate_trino_query(user_query, doc_context)
        
        return {
            "best_practices": trino_practices,
            "documentation_context": doc_context,
            "generated_query": trino_query,
            "retrieved_docs_count": len(retrieved_docs)
        }
        
    except Exception as e:
        return {
            "error": f"Error processing query: {str(e)}"
        }

@app.route('/api/trino/query', methods=['POST'])
def generate_trino_query_endpoint():
    """API endpoint to generate Trino queries with best practices."""
    try:
        # Get JSON input
        data = request.get_json()
        user_query = data.get("user_query", "")
        
        if not user_query:
            return jsonify({
                "status": "error",
                "message": "User query is required",
                "timestamp": time.time()
            }), 400
        
        # Process the query
        result = process_query(user_query)
        
        if "error" in result:
            return jsonify({
                "status": "error",
                "message": result["error"],
                "timestamp": time.time()
            }), 500
        
        return jsonify({
            "status": "success",
            "data": result,
            "timestamp": time.time(),
            "user": "AI Assistant"
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "timestamp": time.time()
        }), 500

@app.route('/api/trino/examples', methods=['GET'])
def get_query_examples():
    """API endpoint to get example Trino queries."""
    examples = [
        "How to create a partitioned table in Trino?",
        "Write a query to analyze JSON data using Trino functions",
        "How to optimize joins between large tables in Trino?",
        "Show me how to use window functions for analytics",
        "How to connect to multiple data sources in a single query?",
        "Write a query using UNNEST for array processing",
        "How to join data from Hive and MySQL using Trino",
        "Write a query to calculate moving averages on time-series data",
        "Optimize a query that processes large JSON arrays in Trino"
    ]
    
    return jsonify({
        "status": "success",
        "data": {
            "examples": examples
        },
        "timestamp": time.time()
    })

@app.route('/api/trino/context', methods=['POST'])
def get_context_only():
    """API endpoint to retrieve only the context documents for a query."""
    try:
        # Get JSON input
        data = request.get_json()
        user_query = data.get("user_query", "")
        
        if not user_query:
            return jsonify({
                "status": "error",
                "message": "User query is required",
                "timestamp": time.time()
            }), 400
        
        if compression_retriever is None:
            return jsonify({
                "status": "error", 
                "message": "FAISS retriever not available. Check server logs for details.",
                "timestamp": time.time()
            }), 500
        
        # Retrieve relevant documentation using FAISS + Cohere reranking
        retrieved_docs = compression_retriever.get_relevant_documents(user_query)
        docs = [{"content": doc.page_content, "metadata": doc.metadata} for doc in retrieved_docs]
        
        return jsonify({
            "status": "success",
            "data": {
                "context_documents": docs
            },
            "timestamp": time.time(),
            "user": "AI Assistant"
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "timestamp": time.time()
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "faiss_available": compression_retriever is not None,
        "timestamp": time.time()
    })

# Run the Flask app
if __name__ == "__main__":
    print("Starting Trino SQL Query Generator with FAISS...")
    print(f"FAISS retriever available: {compression_retriever is not None}")
    app.run(debug=True, host='0.0.0.0', port=5000)