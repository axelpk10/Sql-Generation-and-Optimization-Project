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
import json
from pathlib import Path
from dotenv import load_dotenv
from collections import defaultdict, deque
from datetime import datetime
import redis

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

# Metrics storage for quantitative analysis
metrics_storage = {
    "query_stats": deque(maxlen=1000),  # Keep last 1000 queries
    "optimization_stats": defaultdict(int),
    "dialect_usage": defaultdict(int),
    "response_times": deque(maxlen=1000),
    "error_count": 0,
    "total_queries": 0
}

# Get API keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")
if not COHERE_API_KEY:
    raise ValueError("COHERE_API_KEY not found in environment variables")

# Initialize clients
clientg = Groq(api_key=GROQ_API_KEY)

# Initialize Redis client for conversation context
try:
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        db=0,
        decode_responses=True
    )
    redis_client.ping()
    print("✅ Redis client connected successfully")
except Exception as e:
    print(f"⚠️ Redis connection failed: {e}")
    redis_client = None

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

def get_sql_query_template(dialect="trino"):
    """Template for multi-dialect SQL query generation"""
    dialect_info = {
        "trino": {
            "name": "Trino",
            "features": "distributed query execution, advanced analytics functions, cross-connector joins",
            "syntax": "Trino-specific functions like date_trunc, unnest, json_query"
        },
        "mysql": {
            "name": "MySQL", 
            "features": "ACID transactions, stored procedures, triggers, full-text indexing",
            "syntax": "MySQL functions like DATE_FORMAT, SUBSTRING, LIMIT clause"
        },
        "postgresql": {
            "name": "PostgreSQL",
            "features": "advanced data types, window functions, CTEs, JSON operations", 
            "syntax": "PostgreSQL functions like EXTRACT, STRING_AGG, LATERAL joins"
        },
        "spark": {
            "name": "Apache Spark SQL",
            "features": "distributed computing, DataFrame operations, machine learning integration",
            "syntax": "Spark SQL functions like collect_list, explode, window operations"
        }
    }
    
    info = dialect_info.get(dialect.lower(), dialect_info["trino"])
    
    # NOTE: Using regular string (not f-string) to preserve {{placeholders}} for .format()
    template = """
    You are an expert """ + info['name'] + """ SQL developer. Your task is to generate optimized """ + info['name'] + """ SQL queries 
    that are syntactically correct, efficient, and follow """ + info['name'] + """ best practices.
    
    Target Database: """ + info['name'] + """
    Database Features: """ + info['features'] + """
    Syntax Requirements: """ + info['syntax'] + """
    
    {schema_context}
    
    Given the following:
    User Question: {user_query}
    SQL Context from Documentation: {context}
    
    Please provide:
    1. A detailed """ + info['name'] + """ SQL query that addresses the user's question
    2. An explanation of the query components
    3. Any relevant """ + info['name'] + """-specific optimizations or best practices
    
    **CRITICAL RULES:**
    - If schema context is provided above, you MUST use ONLY those exact table names and column names
    - Do NOT invent, assume, or make up any table names that are not in the schema
    - Do NOT use generic names like 'table', 'customer', 'order' unless they appear in the schema
    - If the user asks about data that doesn't exist in the schema, politely inform them
    - Use """ + info['name'] + """-specific syntax and functions
    - Follow """ + info['name'] + """ performance best practices
    - Ensure compatibility with """ + info['name'] + """ standards
    - Optimize for """ + info['name'] + """ query execution patterns
    
    Format your response as:
    QUERY:
    <the SQL query>
    
    EXPLANATION:
    <detailed explanation>
    
    OPTIMIZATIONS:
    <list of """ + info['name'] + """-specific optimizations>
    """
    
    return template

def generate_sql_query(user_query, context, dialect="trino", schema_context=None, conversation_context=None):
    """Generate a dialect-specific SQL query based on user input and context.
    
    Args:
        user_query: The user's natural language query
        context: Retrieved context from FAISS documentation
        dialect: SQL dialect (trino, mysql, postgresql, spark)
        schema_context: Optional dict with actual database schema
        conversation_context: Optional dict with previous schemas from Schema Generator
    """
    try:
        dialect_descriptions = {
            "trino": "senior Trino SQL expert with deep knowledge of distributed query optimization, performance tuning, and best practices",
            "mysql": "senior MySQL expert with deep knowledge of ACID compliance, indexing strategies, and performance optimization",
            "postgresql": "senior PostgreSQL expert with deep knowledge of advanced features, query optimization, and concurrent access patterns", 
            "spark": "senior Apache Spark SQL expert with deep knowledge of distributed computing, DataFrame operations, and catalyst optimizer"
        }
        
        system_content = dialect_descriptions.get(dialect.lower(), dialect_descriptions["trino"])
        
        # Build schema context section for prompt injection
        schema_section = ""
        if schema_context and schema_context.get('tables'):
            tables = schema_context['tables']
            schema_section = f"\n{'='*80}\n"
            schema_section += f"DATABASE SCHEMA - {len(tables)} TABLES AVAILABLE\n"
            schema_section += f"{'='*80}\n\n"
            schema_section += "**YOU MUST USE ONLY THESE TABLE NAMES - DO NOT MAKE UP TABLE NAMES:**\n\n"
            for table in tables[:20]:  # Limit to first 20 tables to avoid token limits
                table_name = table.get('name', 'unknown')
                columns = table.get('columns', 'N/A')
                schema_section += f"TABLE: {table_name}\n"
                schema_section += f"  Columns: {columns}\n\n"
            schema_section += f"{'='*80}\n"
            schema_section += "**CRITICAL: The user's database contains ONLY the tables listed above.**\n"
            schema_section += "**If you use a table name NOT in this list, the query will fail.**\n"
            schema_section += f"{'='*80}\n\n"
        else:
            schema_section = ""
        
        # Add conversation context from Schema Generator
        conversation_section = ""
        if conversation_context and conversation_context.get('schemas'):
            schemas = conversation_context['schemas']
            conversation_section = f"\n**PREVIOUSLY GENERATED SCHEMAS ({len(schemas)}):**\n"
            conversation_section += "The Schema Generator has created the following table structures in this conversation:\n"
            for idx, schema_item in enumerate(schemas[-3:], 1):  # Last 3 schemas to avoid token limits
                schema_ddl = schema_item.get('schema', '')
                if schema_ddl:
                    # Extract table names from CREATE TABLE statements
                    conversation_section += f"\nSchema {idx}:\n```sql\n{schema_ddl[:500]}...\n```\n"
            conversation_section += "\n**USE THESE SCHEMA DEFINITIONS when generating queries. These are the actual tables that exist.**\n"
        
        # Get template and inject schema context + conversation context
        prompt_template = get_sql_query_template(dialect)
        user_prompt = prompt_template.format(
            user_query=user_query,
            context=context,
            schema_context=schema_section + conversation_section
        )
        
        chat_completion = clientg.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": f"You are a {system_content}."
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            model="llama-3.3-70b-versatile",
            max_tokens=2000,
            temperature=0.3  # Lower temperature for more focused SQL generation
        )
        
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        return f"Error generating {dialect} query: {str(e)}"

def get_sql_best_practices(user_query, dialect="trino"):
    """Get dialect-specific best practices based on the query."""
    try:
        dialect_practices = {
            "trino": {
                "focus": "distributed query optimization, connector efficiency, cross-data source joins",
                "areas": "Connector optimization, Query optimization, Resource management, Performance tuning, Data distribution"
            },
            "mysql": {
                "focus": "indexing strategies, query optimization, transaction management",
                "areas": "Index optimization, Query performance, Transaction handling, Storage engine selection, Memory management"
            },
            "postgresql": {
                "focus": "advanced query optimization, indexing, concurrent access patterns",
                "areas": "Index strategies, Query planning, Vacuum/analyze, Connection pooling, Partitioning"
            },
            "spark": {
                "focus": "distributed computing optimization, DataFrame operations, catalyst optimizer",
                "areas": "Partitioning strategies, Broadcast joins, Caching, Resource allocation, Catalyst optimization"
            }
        }
        
        practices = dialect_practices.get(dialect.lower(), dialect_practices["trino"])
        
        chat_completion = clientg.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": f"You are a {dialect} expert focusing on {practices['focus']}. Provide concise, actionable recommendations."
                },
                {
                    "role": "user",
                    "content": f"""
                    Based on this query: '{user_query}', provide {dialect}-specific best practices considering:
                    {practices['areas']}
                    
                    Only include {dialect}-specific recommendations that are relevant.
                    """
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.4
        )
        
        return clean_text(chat_completion.choices[0].message.content)
        
    except Exception as e:
        return f"Error getting {dialect} best practices: {str(e)}"

def clean_text(text):
    """Clean and format text response."""
    # Remove code blocks
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    # Normalize spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_generated_content(generated_query):
    """Parse the generated content into separate sections for better usability."""
    try:
        sections = {
            "sql_query": "",
            "explanation": "",
            "optimizations": "",
            "best_practices": [],
            "dialect_specific_features": []
        }
        
        # Split content by main sections
        content = generated_query.strip()
        
        # Extract SQL Query
        if "QUERY:" in content:
            query_section = content.split("QUERY:")[1].split("EXPLANATION:")[0].strip()
            # Remove code block markers
            query_section = re.sub(r'```sql\s*', '', query_section)
            query_section = re.sub(r'```\s*', '', query_section)
            sections["sql_query"] = query_section.strip()
        
        # Extract Explanation
        if "EXPLANATION:" in content:
            if "OPTIMIZATIONS:" in content:
                explanation_section = content.split("EXPLANATION:")[1].split("OPTIMIZATIONS:")[0].strip()
            else:
                explanation_section = content.split("EXPLANATION:")[1].strip()
            sections["explanation"] = explanation_section
        
        # Extract Optimizations
        if "OPTIMIZATIONS:" in content:
            optimizations_section = content.split("OPTIMIZATIONS:")[1].strip()
            sections["optimizations"] = optimizations_section
            
            # Parse optimizations into structured format
            optimization_lines = [line.strip() for line in optimizations_section.split('\n') if line.strip()]
            
            for line in optimization_lines:
                if line.startswith(('*', '1.', '2.', '3.', '4.', '5.', '-')):
                    # Extract optimization point
                    clean_line = re.sub(r'^[*\d\-\.\s]+', '', line).strip()
                    if ':' in clean_line:
                        title, description = clean_line.split(':', 1)
                        sections["best_practices"].append({
                            "title": title.strip().replace('**', ''),
                            "description": description.strip(),
                            "category": "performance"
                        })
                    elif clean_line:
                        sections["best_practices"].append({
                            "title": "Optimization",
                            "description": clean_line,
                            "category": "general"
                        })
        
        return sections
        
    except Exception as e:
        # Fallback if parsing fails
        return {
            "sql_query": generated_query,
            "explanation": "Content parsing failed, see full response in sql_query field",
            "optimizations": "",
            "best_practices": [],
            "dialect_specific_features": [],
            "parse_error": str(e)
        }

def collect_query_metrics(user_query, dialect, result, response_time, is_optimization=False):
    """Collect metrics for quantitative analysis"""
    try:
        # Detect if it's an optimization query
        optimization_keywords = ['optimize', 'improve', 'performance', 'faster', 'better']
        is_optimization = is_optimization or any(keyword in user_query.lower() for keyword in optimization_keywords)
        
        # Store query statistics
        query_stat = {
            "timestamp": datetime.now().isoformat(),
            "user_query": user_query[:200],  # Truncate for storage
            "dialect": dialect,
            "response_time": response_time,
            "is_optimization": is_optimization,
            "docs_retrieved": result.get('retrieved_docs_count', 0),
            "best_practices_count": len(result.get('best_practices', [])),
            "has_sql_output": bool(result.get('sql_query', '')),
            "success": 'error' not in result
        }
        
        metrics_storage["query_stats"].append(query_stat)
        metrics_storage["dialect_usage"][dialect] += 1
        metrics_storage["response_times"].append(response_time)
        metrics_storage["total_queries"] += 1
        
        if is_optimization:
            metrics_storage["optimization_stats"]["total_optimizations"] += 1
            metrics_storage["optimization_stats"][f"optimization_{dialect}"] += 1
            
        if 'error' in result:
            metrics_storage["error_count"] += 1
            
    except Exception as e:
        print(f"Error collecting metrics: {str(e)}")

def get_conversation_context(project_id):
    """
    Fetch conversation history from Redis to get context from Schema Generator.
    Returns schemas generated in previous messages.
    """
    if not redis_client or not project_id:
        return None
    
    try:
        session_key = f"ai_session:{project_id}:ai_assistant_session"
        session_data = redis_client.get(session_key)
        
        if not session_data:
            return None
        
        conversation = json.loads(session_data)
        messages = conversation.get('messages', [])
        
        # Extract schemas from previous Schema Generator responses
        schemas = []
        for msg in messages:
            if msg.get('role') == 'assistant' and msg.get('schema'):
                schemas.append({
                    'schema': msg['schema'],
                    'explanation': msg.get('explanation', ''),
                    'timestamp': msg.get('timestamp', '')
                })
        
        if schemas:
            print(f"📚 Retrieved {len(schemas)} schema(s) from conversation history")
            return {'schemas': schemas}
        
        return None
        
    except Exception as e:
        print(f"⚠️ Error fetching conversation context: {e}")
        return None

def process_query(user_query, dialect="trino", schema_context=None, project_id=None):
    """Process the user query and return relevant SQL information for the specified dialect.
    
    Args:
        user_query: The user's natural language query
        dialect: SQL dialect (trino, mysql, postgresql, spark)
        schema_context: Optional dict containing project schema information:
            {
                'tables': [{'name': str, 'columns': str}, ...],
                'totalTables': int
            }
        project_id: Optional project ID for fetching conversation context
    """
    if compression_retriever is None:
        return {
            "error": "FAISS retriever not available. Check server logs for details."
        }
    
    try:
        # Fetch conversation context from Redis (previous schemas)
        conversation_context = get_conversation_context(project_id)
        
        # Retrieve relevant documentation using FAISS + Cohere reranking
        retrieved_docs = compression_retriever.get_relevant_documents(user_query)
        doc_context = "\n\n".join(doc.page_content for doc in retrieved_docs)
        context_summary = [doc.metadata.get('source', 'Unknown') for doc in retrieved_docs[:3]]
        
        # Generate SQL query for specified dialect (with schema context AND conversation context!)
        generated_content = generate_sql_query(
            user_query, 
            doc_context, 
            dialect, 
            schema_context=schema_context,
            conversation_context=conversation_context
        )
        
        # Parse the generated content into structured sections
        parsed_sections = parse_generated_content(generated_content)
        
        # Get additional dialect-specific recommendations
        additional_practices = get_sql_best_practices(user_query, dialect)
        
        return {
            "sql_query": parsed_sections["sql_query"],
            "explanation": parsed_sections["explanation"],
            "optimizations": parsed_sections["optimizations"],
            "best_practices": parsed_sections["best_practices"],
            "additional_recommendations": additional_practices,
            "context_used": ", ".join(context_summary),
            "retrieved_docs_count": len(retrieved_docs),
            "dialect": dialect,
            "dialect_specific_features": parsed_sections.get("dialect_specific_features", []),
            "original_generated_query": generated_content  # Keep for backward compatibility
        }
        
    except Exception as e:
        return {
            "error": f"Error processing query: {str(e)}"
        }

@app.route('/api/sql/query', methods=['POST'])
def generate_sql_query_endpoint():
    """API endpoint to generate SQL queries for any supported dialect."""
    start_time = time.time()
    
    try:
        # Get JSON input
        data = request.get_json()
        user_query = data.get("user_query", "")
        dialect = data.get("dialect", "trino").lower()
        
        # Map analytics dialect to trino for federation queries
        if dialect == "analytics":
            dialect = "trino"
            print(f"🔄 Mapped 'analytics' dialect to 'trino' for federation query support")
        
        # NEW: Accept project context from frontend
        project_id = data.get("project_id")
        project_name = data.get("project_name")
        schema_context = data.get("schema_context")  # Contains tables with columns
        
        # Log context received
        if project_id and schema_context and schema_context.get('tables'):
            print(f"📋 Query for {project_name}: {schema_context.get('totalTables', 0)} tables in context")
        
        # Validate dialect
        supported_dialects = ["trino", "mysql", "postgresql", "spark"]
        if dialect not in supported_dialects:
            return jsonify({
                "status": "error",
                "message": f"Unsupported dialect: {dialect}. Supported dialects: {', '.join(supported_dialects)}",
                "timestamp": time.time()
            }), 400
        
        if not user_query:
            return jsonify({
                "status": "error",
                "message": "User query is required",
                "timestamp": time.time()
            }), 400
        
        # Process the query (passing schema context AND project_id for conversation context)
        result = process_query(user_query, dialect, schema_context=schema_context, project_id=project_id)
        response_time = time.time() - start_time
        
        if "error" in result:
            collect_query_metrics(user_query, dialect, result, response_time)
            return jsonify({
                "status": "error",
                "message": result["error"],
                "timestamp": time.time()
            }), 500

        # Maintain backward compatibility by including generated_query field
        if "generated_query" not in result and "original_generated_query" in result:
            result["generated_query"] = result["original_generated_query"]
        
        # Collect metrics for analysis
        collect_query_metrics(user_query, dialect, result, response_time)
        
        # TODO: Save conversation to Redis via SQL Execution backend
        # if project_id:
        #     session_id = data.get("session_id", "default_session")
        #     save_ai_conversation(project_id, session_id, user_query, result)

        return jsonify({
            "status": "success",
            "data": result,
            "timestamp": time.time(),
            "user": "AI Assistant",
            "project_id": project_id,
            "project_name": project_name
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "timestamp": time.time()
        }), 500

@app.route('/api/trino/query', methods=['POST'])
def generate_trino_query_endpoint():
    """API endpoint to generate Trino queries with best practices (for backward compatibility)."""
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
        
        # Process the query with Trino dialect
        result = process_query(user_query, "trino")
        
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


@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Metrics endpoint for quantitative analysis of query optimization"""
    try:
        # Calculate summary statistics
        query_stats_list = list(metrics_storage["query_stats"])
        response_times_list = list(metrics_storage["response_times"])
        
        # Basic statistics
        total_queries = metrics_storage["total_queries"]
        error_count = metrics_storage["error_count"]
        success_rate = ((total_queries - error_count) / total_queries * 100) if total_queries > 0 else 0
        
        # Response time statistics
        if response_times_list:
            avg_response_time = sum(response_times_list) / len(response_times_list)
            min_response_time = min(response_times_list)
            max_response_time = max(response_times_list)
        else:
            avg_response_time = min_response_time = max_response_time = 0
        
        # Optimization statistics
        optimization_queries = [q for q in query_stats_list if q.get('is_optimization', False)]
        optimization_rate = (len(optimization_queries) / len(query_stats_list) * 100) if query_stats_list else 0
        
        # Dialect usage analysis
        dialect_stats = dict(metrics_storage["dialect_usage"])
        most_used_dialect = max(dialect_stats, key=dialect_stats.get) if dialect_stats else "none"
        
        # Best practices analysis
        if query_stats_list:
            avg_best_practices = sum(q.get('best_practices_count', 0) for q in query_stats_list) / len(query_stats_list)
            avg_docs_retrieved = sum(q.get('docs_retrieved', 0) for q in query_stats_list) / len(query_stats_list)
        else:
            avg_best_practices = avg_docs_retrieved = 0
        
        # Recent activity (last 10 queries)
        recent_queries = query_stats_list[-10:] if query_stats_list else []
        
        return jsonify({
            "status": "success",
            "data": {
                "summary": {
                    "total_queries": total_queries,
                    "success_rate": round(success_rate, 2),
                    "error_count": error_count,
                    "optimization_rate": round(optimization_rate, 2),
                    "avg_response_time": round(avg_response_time, 3),
                    "min_response_time": round(min_response_time, 3),
                    "max_response_time": round(max_response_time, 3)
                },
                "dialect_usage": dialect_stats,
                "most_used_dialect": most_used_dialect,
                "optimization_stats": dict(metrics_storage["optimization_stats"]),
                "performance_analysis": {
                    "avg_best_practices_per_query": round(avg_best_practices, 1),
                    "avg_docs_retrieved_per_query": round(avg_docs_retrieved, 1),
                    "total_optimizations": len(optimization_queries)
                },
                "recent_activity": recent_queries,
                "system_health": {
                    "faiss_available": compression_retriever is not None,
                    "metrics_stored": len(query_stats_list)
                }
            },
            "timestamp": time.time()
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error retrieving metrics: {str(e)}",
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