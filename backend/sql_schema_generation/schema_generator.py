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
    
    def generate_schema(self, requirements: str, dialect: str = "postgresql", conversation_context=None, existing_schema=None) -> Dict[str, Any]:
        """Generate database schema based on requirements for specific dialect"""
        start_time = time.time()
        
        logger.info(f"\n{'='*80}")
        logger.info(f"SCHEMA GENERATOR - EXISTING SCHEMA CONTEXT CHECK")
        logger.info(f"{'='*80}")
        if existing_schema:
            tables = existing_schema.get('tables', [])
            logger.info(f"✅ Existing schema received: {len(tables)} tables")
            logger.info(f"   Tables: {[t.get('name') for t in tables[:10]]}")
        else:
            logger.info(f"❌ No existing schema provided (existing_schema={existing_schema})")
        logger.info(f"{'='*80}\n")
        
        try:
            # Validate dialect
            supported_dialects = ['mysql', 'postgresql', 'trino', 'spark']
            if dialect.lower() not in supported_dialects:
                return {
                    "success": False,
                    "error": f"Unsupported dialect: {dialect}. Supported: {supported_dialects}",
                    "schema": None,
                    "explanation": None
                }
            
            dialect = dialect.lower()
            
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
            
            # Create dialect-specific prompt with conversation context AND existing schema
            prompt = self.create_schema_prompt(requirements, context, dialect, conversation_context, existing_schema)
            
            # Log prompt preview to verify existing schema is included
            logger.info(f"\n{'='*80}")
            logger.info(f"FINAL PROMPT PREVIEW (first 1000 chars)")
            logger.info(f"{'='*80}")
            logger.info(prompt[:1000])
            if "EXISTING DATABASE SCHEMA" in prompt:
                logger.info(f"\n✅ EXISTING SCHEMA FOUND IN PROMPT")
            else:
                logger.info(f"\n❌ EXISTING SCHEMA NOT FOUND IN PROMPT")
            logger.info(f"{'='*80}\n")
            
            # Get dialect-specific system prompt
            system_prompt = self.get_schema_prompt_template(dialect)
            
            # Generate schema using Groq with dialect-specific prompts
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            # Parse response with structured format
            content = response.choices[0].message.content
            schema, explanation, optimizations, best_practices = self.parse_schema_response(content)
            
            end_time = time.time()
            response_time = end_time - start_time
            
            # Log analytics with dialect information
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
                    llm_model="llama-3.3-70b-versatile",
                    dialect=dialect  # Add dialect to analytics
                )
                logger.info(f"Analytics logged for schema ID: {schema_id}")
            except Exception as analytics_error:
                logger.warning(f"Failed to log analytics: {analytics_error}")
            
            return {
                "success": True,
                "schema": schema,
                "explanation": explanation,
                "optimizations": optimizations,
                "best_practices": best_practices,
                "dialect": dialect,
                "dialect_features": self.get_dialect_features(dialect),
                "response_time": response_time,
                "docs_retrieved": len(docs),
                "docs_used": len(reranked_docs),
                "generated_content": content  # Full LLM response for debugging
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
    
    def get_schema_prompt_template(self, dialect: str) -> str:
        """Get dialect-specific system prompt for schema generation"""
        base_prompt = """You are an expert database architect specializing in schema design and optimization.
        
Your responses should be:
1. Technically accurate and follow database best practices
2. Include proper data types, constraints, and indexing strategies
3. Consider performance, scalability, and maintainability
4. Provide clear explanations for design decisions

Format your response as:
[SCHEMA]
<DDL statements - PLAIN TEXT ONLY, NO MARKDOWN CODE FENCES, NO ```sql or ``` markers>
[EXPLANATION]
<Design rationale and best practices>
[OPTIMIZATIONS]
<Performance recommendations>
[BEST_PRACTICES]
<Categorized best practices with title, description, category>

**CRITICAL: In the [SCHEMA] section, write ONLY pure SQL DDL statements. Do NOT wrap them in markdown code blocks (```sql). Write raw SQL only.**
"""
        
        dialect_specifics = {
            'mysql': """
MYSQL SPECIFIC REQUIREMENTS:
- Use AUTO_INCREMENT for primary keys, never SERIAL
- Specify ENGINE=InnoDB for ACID compliance
- Use appropriate MySQL data types (INT, VARCHAR, TEXT, DATETIME)
- Add DEFAULT CHARSET=utf8mb4 for full Unicode support
- Use UNIQUE KEY and INDEX syntax specific to MySQL
- Consider partitioning for large tables
- Include proper foreign key constraints with ON DELETE/UPDATE actions
- Use TIMESTAMP DEFAULT CURRENT_TIMESTAMP for audit fields""",
            
            'postgresql': """
POSTGRESQL SPECIFIC REQUIREMENTS:
- Use SERIAL or IDENTITY columns for auto-incrementing primary keys
- Leverage JSONB for flexible JSON storage with indexing
- Use appropriate PostgreSQL data types (BIGSERIAL, TIMESTAMPTZ, ARRAY)
- Include proper constraints (CHECK, UNIQUE, FOREIGN KEY)
- Consider table partitioning for large datasets
- Use CREATE INDEX CONCURRENTLY for production environments
- Implement proper schema organization with namespaces
- Use GENERATED ALWAYS AS for computed columns where applicable""",
            
            'trino': """
TRINO SPECIFIC REQUIREMENTS:
- NO auto-increment columns (Trino doesn't support them)
- Use BIGINT for ID columns with manual sequence generation
- Design for distributed queries across multiple data sources
- Include proper partitioning strategies (especially for Hive connector)
- Use appropriate data types for the target connector
- Consider bucketing for join optimization
- Design schemas for cross-catalog queries
- Include table properties for connector-specific optimizations
- Focus on columnar storage optimization""",
            
            'spark': """
SPARK SQL SPECIFIC REQUIREMENTS:
- Design for Delta tables with ACID transactions
- NO auto-increment (use monotonically_increasing_id() or UUID)
- Include partitioning columns for distributed performance
- Use appropriate Spark SQL data types (BIGINT, STRING, TIMESTAMP)
- Consider schema evolution and backward compatibility
- Design for both batch and streaming workloads
- Include table properties for Delta optimizations
- Use proper data layout for query performance
- Consider Z-ordering for frequently queried columns"""
        }
        
        return base_prompt + dialect_specifics.get(dialect, "")
    
    def create_schema_prompt(self, requirements: str, context: str, dialect: str, conversation_context=None, existing_schema=None) -> str:
        """Create dialect-specific prompt for schema generation"""
        dialect_features = self.get_dialect_features(dialect)
        
        logger.info(f"\n{'='*80}")
        logger.info(f"CREATE_SCHEMA_PROMPT - EXISTING SCHEMA CHECK")
        logger.info(f"{'='*80}")
        
        # Add existing schema context
        existing_schema_section = ""
        if existing_schema and existing_schema.get('tables'):
            tables = existing_schema['tables']
            logger.info(f"✅ Building existing schema section with {len(tables)} tables")
            logger.info(f"   First 3 tables: {[t.get('name') for t in tables[:3]]}")
            
            existing_schema_section = f"\n{'='*80}\n"
            existing_schema_section += f"EXISTING DATABASE SCHEMA - {len(tables)} TABLES\n"
            existing_schema_section += f"{'='*80}\n\n"
            existing_schema_section += "**The database currently has these tables:**\n\n"
            for table in tables[:20]:  # Limit to 20 tables
                table_name = table.get('name', 'unknown')
                columns = table.get('columns', 'N/A')
                existing_schema_section += f"TABLE: {table_name}\n"
                existing_schema_section += f"  Columns: {columns}\n\n"
            existing_schema_section += f"{'='*80}\n"
            existing_schema_section += "**CRITICAL INSTRUCTIONS - MUST FOLLOW:**\n"
            existing_schema_section += "1. The database ALREADY HAS these tables - DO NOT recreate them\n"
            existing_schema_section += "2. ONLY create NEW tables that are requested\n"
            existing_schema_section += "3. Use foreign keys to reference existing table IDs (e.g., user_id references users, product_id references products)\n"
            existing_schema_section += "4. Follow the existing naming conventions (e.g., if tables use plural names, continue that pattern)\n"
            existing_schema_section += "5. Keep it SIMPLE - do not add unnecessary OLAP, data warehouse, or complex structures unless specifically requested\n"
            existing_schema_section += "6. Match the existing column naming style and data types\n"
            existing_schema_section += f"{'='*80}\n\n"
            
            logger.info(f"✅ Existing schema section built ({len(existing_schema_section)} chars)")
        else:
            logger.info(f"❌ No existing schema to inject (existing_schema={existing_schema})")
        
        logger.info(f"{'='*80}\n")
        
        # Add conversation context from Query Generator
        conversation_section = ""
        if conversation_context and conversation_context.get('queries'):
            queries = conversation_context['queries']
            conversation_section = f"\n\n**PREVIOUSLY GENERATED QUERIES ({len(queries)}):**\n"
            conversation_section += "The Query Generator has created the following SQL queries in this conversation:\n"
            for idx, query_item in enumerate(queries[-3:], 1):  # Last 3 queries to avoid token limits
                query_sql = query_item.get('query', '')
                if query_sql:
                    conversation_section += f"\nQuery {idx}:\n```sql\n{query_sql[:300]}...\n```\n"
            conversation_section += "\n**DESIGN SCHEMA to support these queries. Ensure tables, columns, and relationships match query requirements.**\n"
        
        # Determine if this is an extension request or new schema request
        is_extension = existing_schema and existing_schema.get('tables')
        
        if is_extension:
            # Extending existing schema - prioritize simplicity and integration
            return f"""You are extending an existing database schema.

{existing_schema_section}

**USER REQUEST:** {requirements}
{conversation_section}

Target Database: {dialect.upper()}
Dialect Features: {', '.join(dialect_features)}

**YOUR TASK:**
Create ONLY the NEW tables requested. DO NOT recreate existing tables. Keep it simple and focused.

Design guidelines:
1. Create minimal tables needed to fulfill the request
2. Reference existing tables using foreign keys (user_id → users.id, product_id → products.id, etc.)
3. Match existing naming patterns and data types
4. Use appropriate {dialect.upper()} syntax and features

Reference documentation (use only if helpful for syntax/features):
{context[:500]}...

Please provide:
1. CREATE TABLE statements with {dialect}-appropriate data types
2. Primary keys, foreign keys, and constraints specific to {dialect}
3. Indexing strategies optimized for {dialect}
4. Partitioning recommendations if applicable for {dialect}
5. Best practices specific to {dialect} database

Focus on {dialect}-specific performance, scalability, and maintainability features."""
        else:
            # New schema from scratch
            return f"""Based on the following database design documentation:

{context}

Target Database: {dialect.upper()}
Dialect Features: {', '.join(dialect_features)}

Requirements: {requirements}
{conversation_section}

Please design an optimal {dialect.upper()} database schema including:
1. CREATE TABLE statements with {dialect}-appropriate data types
2. Primary keys, foreign keys, and constraints specific to {dialect}
3. Indexing strategies optimized for {dialect}
4. Partitioning recommendations if applicable for {dialect}
5. Best practices specific to {dialect} database

Focus on {dialect}-specific performance, scalability, and maintainability features."""
    
    def get_dialect_features(self, dialect: str) -> List[str]:
        """Get key features for each database dialect"""
        features = {
            'mysql': [
                'AUTO_INCREMENT', 'InnoDB Engine', 'MyISAM Engine', 'CHARSET utf8mb4',
                'Partitioning', 'Foreign Keys', 'Full-text Indexing', 'JSON data type'
            ],
            'postgresql': [
                'SERIAL/IDENTITY', 'JSONB', 'Array Types', 'CTEs', 'Window Functions',
                'Table Partitioning', 'Concurrent Indexing', 'Schemas/Namespaces'
            ],
            'trino': [
                'Cross-catalog Queries', 'Connector-based', 'Distributed Joins',
                'Bucketing', 'Table Properties', 'Columnar Storage', 'Push-down Optimization'
            ],
            'spark': [
                'Delta Tables', 'Schema Evolution', 'Partitioning', 'Z-ordering',
                'ACID Transactions', 'Time Travel', 'Streaming Support', 'Broadcast Joins'
            ]
        }
        return features.get(dialect, [])
    
    def parse_schema_response(self, content: str) -> tuple:
        """Parse the LLM response into schema, explanation, optimizations, and best_practices"""
        try:
            schema = ""
            explanation = ""
            optimizations = ""
            best_practices = []
            
            if "[SCHEMA]" in content:
                parts = content.split("[SCHEMA]", 1)
                if len(parts) > 1:
                    remaining = parts[1]
                    
                    # Clean up markdown code fences that may have slipped in
                    remaining = remaining.replace('```sql', '').replace('```', '')
                    
                    if "[EXPLANATION]" in remaining:
                        schema_part, rest = remaining.split("[EXPLANATION]", 1)
                        # Clean up the schema section
                        schema = schema_part.strip()
                        # Remove any lingering markdown artifacts
                        schema = schema.replace('```sql', '').replace('```', '').strip()
                        
                        if "[OPTIMIZATIONS]" in rest:
                            explanation_part, opt_rest = rest.split("[OPTIMIZATIONS]", 1)
                            explanation = explanation_part.strip()
                            
                            if "[BEST_PRACTICES]" in opt_rest:
                                opt_part, bp_part = opt_rest.split("[BEST_PRACTICES]", 1)
                                optimizations = opt_part.strip()
                                best_practices = self.parse_best_practices(bp_part.strip())
                            else:
                                optimizations = opt_rest.strip()
                        else:
                            explanation = rest.strip()
                    else:
                        schema = remaining.strip()
            else:
                # Fallback: use entire content as schema
                schema = content.strip()
            
            return schema, explanation, optimizations, best_practices
            
        except Exception as e:
            logger.error(f"Error parsing response: {str(e)}")
            return content.strip(), "", "", []
    
    def parse_best_practices(self, bp_content: str) -> List[Dict[str, str]]:
        """Parse best practices section into structured format"""
        practices = []
        try:
            # Simple parsing - split by numbered items or bullet points
            lines = bp_content.split('\n')
            current_practice = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Check if it's a new practice (starts with number or bullet)
                if line[0].isdigit() or line.startswith('-') or line.startswith('*'):
                    if current_practice:
                        practices.append(current_practice)
                    
                    # Extract title (remove numbering/bullets)
                    title = line.lstrip('0123456789.-* ').split(':')[0].strip()
                    description = ':'.join(line.split(':')[1:]).strip() if ':' in line else line.lstrip('0123456789.-* ').strip()
                    
                    current_practice = {
                        "title": title[:50],  # Limit title length
                        "description": description,
                        "category": "general"  # Default category
                    }
                    
                    # Categorize based on keywords
                    if any(keyword in line.lower() for keyword in ['index', 'performance', 'optimize', 'speed']):
                        current_practice["category"] = "performance"
                    elif any(keyword in line.lower() for keyword in ['security', 'auth', 'permission', 'access']):
                        current_practice["category"] = "security"
                else:
                    # Continuation of current practice description
                    if current_practice:
                        current_practice["description"] += f" {line}"
            
            # Add the last practice
            if current_practice:
                practices.append(current_practice)
                
        except Exception as e:
            logger.error(f"Error parsing best practices: {str(e)}")
            
        return practices[:10]  # Limit to 10 practices

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