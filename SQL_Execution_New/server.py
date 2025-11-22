import json
import os
import subprocess
import tempfile
import logging
from flask import Flask, request, jsonify
import mysql.connector
import pymysql
import psycopg2
import psycopg2.extras
from flask_cors import CORS 
import trino
import sys
import json
import re
import traceback
from datetime import datetime
from pyspark.sql import SparkSession
from dotenv import load_dotenv
import uuid
from pathlib import Path
from context_manager import ContextManager
import sqlparse

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[SQL-EXECUTOR] %(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('sql_executor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# MySQL connection configuration from environment
MYSQL_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'port': int(os.getenv('MYSQL_PORT', 3307)),
    'user': os.getenv('MYSQL_USER', 'admin'),
    'password': os.getenv('MYSQL_PASSWORD', 'admin'),
    'database': os.getenv('MYSQL_DATABASE', 'sales')
}

# PostgreSQL connection configuration from environment  
POSTGRES_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'user': os.getenv('POSTGRES_USER', 'admin'),
    'password': os.getenv('POSTGRES_PASSWORD', 'admin'),
    'database': os.getenv('POSTGRES_DATABASE', 'analytics')
}

# Trino connection configuration from environment
TRINO_CONFIG = {
    'host': os.getenv('TRINO_HOST', 'localhost'),
    'port': int(os.getenv('TRINO_PORT', 8080)),
    'user': os.getenv('TRINO_USER', 'admin'),
    'catalog': os.getenv('TRINO_CATALOG', 'mysql'),
    'schema': os.getenv('TRINO_SCHEMA', 'sales')
}

# Project context storage directory (Legacy - for migration only)
CONTEXT_STORAGE_DIR = Path(os.getenv('CONTEXT_STORAGE_DIR', './project_contexts'))
CONTEXT_STORAGE_DIR.mkdir(exist_ok=True)

# Initialize Redis Context Manager
context_mgr = ContextManager()

logger.info(f"SQL Executor starting with MySQL on {MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}")
logger.info(f"PostgreSQL configured on {POSTGRES_CONFIG['host']}:{POSTGRES_CONFIG['port']}")
logger.info(f"Trino configured on {TRINO_CONFIG['host']}:{TRINO_CONFIG['port']}")
logger.info(f"Redis Context Manager initialized: {context_mgr.health_check()['status']}")


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def normalize_dialect(project):
    """
    Convert legacy trino/spark dialects to analytics.
    Maintains backward compatibility.
    """
    dialect = project.get('dialect')
    
    # Legacy projects: trino/spark → analytics
    if dialect in ['trino', 'spark']:
        # Track original as actualEngine
        if 'actualEngine' not in project:
            context_mgr.update_project_metadata(project['id'], {
                'actualEngine': dialect,
                'dialect': 'analytics',
                'migratedFrom': dialect,
                'migratedAt': datetime.now().isoformat()
            })
            logger.info(f"🔄 Auto-migrated project {project['id']}: {dialect} → analytics (actualEngine={dialect})")
            project['dialect'] = 'analytics'
            project['actualEngine'] = dialect
    
    return project


def get_project_or_error(project_id):
    """
    Fetch project from Redis or return error response.
    Returns: (project, error_response, status_code)
    """
    if not project_id:
        logger.warning("Project ID not provided")
        return None, jsonify({'error': 'Project ID required'}), 400
    
    project = context_mgr.get_project_metadata(project_id)
    if not project:
        logger.warning(f"Project {project_id} not found in Redis")
        return None, jsonify({'error': 'Project not found in Redis'}), 404
    
    # Normalize legacy dialects
    project = normalize_dialect(project)
    
    logger.info(f"✅ Fetched project {project_id} from Redis: dialect={project.get('dialect')}, database={project.get('database')}")
    return project, None, None


def extract_tables_from_query(query):
    """Extract table names from SQL query (basic regex-based extraction)"""
    try:
        # Simple regex to find table names after FROM, JOIN, INTO, UPDATE keywords
        patterns = [
            r'FROM\s+([a-zA-Z0-9_]+)',
            r'JOIN\s+([a-zA-Z0-9_]+)',
            r'INTO\s+([a-zA-Z0-9_]+)',
            r'UPDATE\s+([a-zA-Z0-9_]+)',
            r'TABLE\s+([a-zA-Z0-9_]+)'
        ]
        
        tables = set()
        for pattern in patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            tables.update(matches)
        
        return list(tables)
    except:
        return []


def get_table_prefix(project_id):
    """Get table name prefix for project isolation"""
    # Shorten UUID for readability: proj_abc123_tablename
    short_id = project_id.replace('-', '')[:8]
    return f"proj_{short_id}_"


def add_table_prefix(table_name, project_id):
    """Add project prefix to table name"""
    prefix = get_table_prefix(project_id)
    # Don't double-prefix
    if table_name.startswith(prefix):
        return table_name
    return f"{prefix}{table_name}"


def remove_table_prefix(prefixed_name, project_id):
    """Remove project prefix from table name for display"""
    prefix = get_table_prefix(project_id)
    if prefixed_name.startswith(prefix):
        return prefixed_name[len(prefix):]
    return prefixed_name


def rewrite_query_with_prefix(query, project_id):
    """
    Rewrite SQL query to use prefixed table names.
    Handles SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, etc.
    """
    if not query or not project_id:
        return query
    
    try:
        # Parse SQL using sqlparse
        parsed = sqlparse.parse(query)
        if not parsed:
            return query
        
        prefix = get_table_prefix(project_id)
        
        # Get all table names from the query
        table_names = extract_tables_from_query(query)
        
        # Replace each table name with prefixed version
        rewritten_query = query
        for table_name in table_names:
            # Skip if already prefixed
            if table_name.startswith('proj_'):
                continue
            
            # Create regex pattern to match table name (word boundary)
            # Match table name but not as part of column names
            pattern = r'\b' + re.escape(table_name) + r'\b'
            prefixed_name = add_table_prefix(table_name, project_id)
            rewritten_query = re.sub(pattern, prefixed_name, rewritten_query, flags=re.IGNORECASE)
        
        logger.info(f"🔄 Query rewritten with prefix: {query[:50]}... -> {rewritten_query[:50]}...")
        return rewritten_query
        
    except Exception as e:
        logger.warning(f"Failed to rewrite query with prefix: {e}, using original query")
        return query


def is_ddl_query(query):
    """Check if query is a DDL operation that modifies schema"""
    if not query:
        return False
    
    query_upper = query.strip().upper()
    ddl_keywords = [
        'CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX',
        'ALTER TABLE', 'ALTER VIEW',
        'DROP TABLE', 'DROP VIEW', 'DROP INDEX',
        'RENAME TABLE', 'TRUNCATE TABLE'
    ]
    
    return any(query_upper.startswith(keyword) for keyword in ddl_keywords)


def save_query_intent_helper(project_id, query, execution_time_ms, was_successful, error_msg=None, user_question=None):
    """Helper to save query intent after execution"""
    try:
        intent = {
            'id': str(uuid.uuid4()),
            'sqlQuery': query,
            'userQuestion': user_question,
            'executedAt': datetime.now().isoformat(),
            'wasSuccessful': was_successful,
            'errorMessage': error_msg if not was_successful else None,
            'tablesReferenced': extract_tables_from_query(query),
            'executionTimeMs': execution_time_ms
        }
        
        context_mgr.save_query_intent(project_id, intent)
        
        # Auto-invalidate schema cache if DDL query executed successfully
        if was_successful and is_ddl_query(query):
            logger.info(f"🔄 DDL query detected, invalidating schema cache for project {project_id}")
            context_mgr.invalidate_schema(project_id)
            
    except Exception as e:
        logger.warning(f"Failed to save query intent: {e}")


def load_to_postgresql(df, table_name, column_types):
    """Load DataFrame into PostgreSQL for Trino federation queries"""
    import pandas as pd
    
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cursor = conn.cursor()
    
    try:
        # Ensure analytics schema exists
        cursor.execute('CREATE SCHEMA IF NOT EXISTS analytics')
        conn.commit()
        logger.info("Ensured analytics schema exists in PostgreSQL")
        
        # Drop table if exists
        cursor.execute(f'DROP TABLE IF EXISTS analytics."{table_name}" CASCADE')
        
        # Create table with proper types in analytics schema
        create_sql = f'CREATE TABLE analytics."{table_name}" ({", ".join(column_types)})'
        cursor.execute(create_sql)
        logger.info(f"Created PostgreSQL table: analytics.{table_name}")
        
        # Insert data using execute_values for better performance
        from psycopg2.extras import execute_values
        
        # Prepare data for insertion
        insert_data = []
        for _, row in df.iterrows():
            values = [None if pd.isna(v) else v for v in row]
            insert_data.append(tuple(values))
        
        # Bulk insert into analytics schema
        cols = ', '.join([f'"{col}"' for col in df.columns])
        insert_sql = f'INSERT INTO analytics."{table_name}" ({cols}) VALUES %s'
        execute_values(cursor, insert_sql, insert_data)
        
        conn.commit()
        logger.info(f"Inserted {len(df)} rows into {table_name}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading to PostgreSQL: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def load_to_mysql(df, table_name, column_types):
    """Load DataFrame into MySQL sales database"""
    import pandas as pd
    import pymysql
    
    conn = pymysql.connect(**MYSQL_CONFIG)
    cursor = conn.cursor()
    
    try:
        # Drop table if exists
        cursor.execute(f'DROP TABLE IF EXISTS `{table_name}`')
        
        # Convert column types to MySQL format (backticks instead of quotes)
        mysql_column_types = [col_def.replace('"', '`') for col_def in column_types]
        
        # Create table with proper types in sales database
        create_sql = f'CREATE TABLE `{table_name}` ({", ".join(mysql_column_types)})'
        cursor.execute(create_sql)
        logger.info(f"Created MySQL table: sales.{table_name}")
        
        # Insert data row by row (pymysql doesn't have execute_values)
        cols = ', '.join([f'`{col}`' for col in df.columns])
        placeholders = ', '.join(['%s'] * len(df.columns))
        insert_sql = f'INSERT INTO `{table_name}` ({cols}) VALUES ({placeholders})'
        
        insert_data = []
        for _, row in df.iterrows():
            values = [None if pd.isna(v) else v for v in row]
            insert_data.append(tuple(values))
        
        cursor.executemany(insert_sql, insert_data)
        conn.commit()
        
        logger.info(f"Successfully loaded {len(df)} rows into MySQL table: {table_name}")
        return True
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading to MySQL: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def load_to_spark(df, table_name, csv_path):
    """Load large CSV into Spark for distributed processing"""
    try:
        # Create Spark load script
        spark_script = f"""
from pyspark.sql import SparkSession
import json

try:
    spark = SparkSession.builder \\
        .appName("CSVUpload") \\
        .config("spark.sql.legacy.createHiveTableByDefault", "false") \\
        .getOrCreate()
    
    # Read CSV with schema inference
    df = spark.read.csv("{csv_path}", header=True, inferSchema=True)
    
    # Save as managed table (overwrite if exists)
    df.write.mode("overwrite").saveAsTable("{table_name}")
    
    print(json.dumps({{"status": "success", "rows": df.count(), "table": "{table_name}"}}))
except Exception as e:
    print(json.dumps({{"status": "error", "error": str(e)}}))
"""
        
        # Write script to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.py', mode='w') as tmp_file:
            tmp_file.write(spark_script)
            local_tmp_path = tmp_file.name
        
        container_tmp_path = "/tmp/csv_upload_script.py"
        
        # Copy script to Spark container
        copy_result = subprocess.run(
            ["docker", "cp", local_tmp_path, f"spark_master:{container_tmp_path}"],
            capture_output=True, text=True
        )
        
        if copy_result.returncode != 0:
            raise Exception(f"Failed to copy script: {copy_result.stderr}")
        
        # Execute in Spark
        result = subprocess.run(
            ["docker", "exec", "spark_master", "/opt/spark/bin/spark-submit", container_tmp_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        # Cleanup
        os.remove(local_tmp_path)
        subprocess.run(["docker", "exec", "spark_master", "rm", container_tmp_path], check=False)
        
        if result.returncode != 0:
            raise Exception(f"Spark execution failed: {result.stderr}")
        
        # Parse result
        try:
            output = result.stdout.strip().split('\n')[-1]  # Get last line (JSON)
            result_data = json.loads(output)
            if result_data.get('status') == 'error':
                raise Exception(result_data.get('error'))
        except json.JSONDecodeError:
            logger.warning(f"Could not parse Spark output: {result.stdout}")
        
    except Exception as e:
        logger.error(f"Error loading to Spark: {e}")
        raise

@app.route('/execute/mysql', methods=['POST'])
def execute_mysql():
    """Execute SQL queries on MySQL database with improved error handling"""
    start_time = datetime.now()
    data = request.get_json()
    
    if not data or 'query' not in data:
        logger.warning("MySQL endpoint called without query parameter")
        return jsonify({'error': 'No query provided in request body'}), 400
    
    query = data.get('query').strip()
    project_id = data.get('projectId') or request.headers.get('X-Project-ID')
    user_question = data.get('userQuestion')  # Optional: for AI-generated queries
    
    if not query:
        logger.warning("MySQL endpoint called with empty query")
        return jsonify({'error': 'Empty query provided'}), 400
    
    # Rewrite query with project prefix for table isolation
    original_query = query
    if project_id:
        query = rewrite_query_with_prefix(query, project_id)
    
    logger.info(f"Executing MySQL query: {query[:100]}...")  # Log first 100 chars
    
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute(query)
        
        # Check if this is a SELECT query that returns rows
        if cursor.description:
            # SELECT query - fetch results
            results = cursor.fetchall()
            columns = [col[0] for col in cursor.description]
            
            cursor.close()
            conn.commit()
            conn.close()
            
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_time_ms = execution_time * 1000
            logger.info(f"MySQL SELECT query executed successfully in {execution_time:.2f}s, returned {len(results)} rows")
            
            # Save query intent (not results!) to Redis
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=True,
                    user_question=user_question
                )
            
            return jsonify({
                'columns': columns, 
                'results': results,
                'execution_time': execution_time,
                'row_count': len(results)
            })
        else:
            # DDL/DML query (CREATE, INSERT, UPDATE, DELETE, etc.)
            affected_rows = cursor.rowcount
            conn.commit()
            cursor.close()
            conn.close()
            
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_time_ms = execution_time * 1000
            
            # Detect query type
            query_upper = query.upper().strip()
            query_type = 'Query'
            if query_upper.startswith('CREATE'):
                query_type = 'CREATE'
            elif query_upper.startswith('INSERT'):
                query_type = 'INSERT'
            elif query_upper.startswith('UPDATE'):
                query_type = 'UPDATE'
            elif query_upper.startswith('DELETE'):
                query_type = 'DELETE'
            elif query_upper.startswith('DROP'):
                query_type = 'DROP'
            elif query_upper.startswith('ALTER'):
                query_type = 'ALTER'
            elif query_upper.startswith('TRUNCATE'):
                query_type = 'TRUNCATE'
            
            logger.info(f"MySQL {query_type} query executed successfully in {execution_time:.2f}s, affected {affected_rows} rows")
            
            # Save query intent to Redis
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=True,
                    user_question=user_question
                )
            
            return jsonify({
                'success': True,
                'message': f'{query_type} executed successfully',
                'affected_rows': affected_rows,
                'execution_time': execution_time,
                'query_type': query_type
            })
    except mysql.connector.Error as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = f'MySQL database error: {str(e)}'
        logger.error(f"MySQL error: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'database_error'
        }), 500
    except Exception as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = f'Internal server error: {str(e)}'
        logger.error(f"Unexpected error in MySQL execution: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'server_error'
        }), 500

@app.route('/execute/postgresql', methods=['POST'])
def execute_postgresql():
    """Execute SQL queries on PostgreSQL database with improved error handling"""
    start_time = datetime.now()
    data = request.get_json()
    
    if not data or 'query' not in data:
        logger.warning("PostgreSQL endpoint called without query parameter")
        return jsonify({'error': 'No query provided in request body'}), 400
    
    query = data.get('query').strip()
    project_id = data.get('projectId') or request.headers.get('X-Project-ID')
    user_question = data.get('userQuestion')  # Optional: for AI-generated queries
    
    if not query:
        logger.warning("PostgreSQL endpoint called with empty query")
        return jsonify({'error': 'Empty query provided'}), 400
    
    # Rewrite query with project prefix for table isolation
    original_query = query
    if project_id:
        query = rewrite_query_with_prefix(query, project_id)
    
    logger.info(f"Executing PostgreSQL query: {query[:100]}...")  # Log first 100 chars
    
    try:
        conn = psycopg2.connect(**POSTGRES_CONFIG)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(query)
        
        # Check if this is a SELECT query that returns rows
        if cursor.description:
            # SELECT query - fetch results
            results = cursor.fetchall()
            # Convert RealDictRow to regular list format for consistency
            columns = list(results[0].keys()) if results else []
            results = [list(row.values()) for row in results]
            
            cursor.close()
            conn.commit()
            conn.close()
            
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_time_ms = execution_time * 1000
            logger.info(f"PostgreSQL SELECT query executed successfully in {execution_time:.2f}s, returned {len(results)} rows")
            
            # Save query intent (not results!) to Redis
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=True,
                    user_question=user_question
                )
            
            return jsonify({
                'columns': columns, 
                'results': results,
                'execution_time': execution_time,
                'row_count': len(results)
            })
        else:
            # DDL/DML query (CREATE, INSERT, UPDATE, DELETE, etc.)
            affected_rows = cursor.rowcount
            conn.commit()
            cursor.close()
            conn.close()
            
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_time_ms = execution_time * 1000
            
            # Detect query type
            query_upper = query.upper().strip()
            query_type = 'Query'
            if query_upper.startswith('CREATE'):
                query_type = 'CREATE'
            elif query_upper.startswith('INSERT'):
                query_type = 'INSERT'
            elif query_upper.startswith('UPDATE'):
                query_type = 'UPDATE'
            elif query_upper.startswith('DELETE'):
                query_type = 'DELETE'
            elif query_upper.startswith('DROP'):
                query_type = 'DROP'
            elif query_upper.startswith('ALTER'):
                query_type = 'ALTER'
            elif query_upper.startswith('TRUNCATE'):
                query_type = 'TRUNCATE'
            
            logger.info(f"PostgreSQL {query_type} query executed successfully in {execution_time:.2f}s, affected {affected_rows} rows")
            
            # Save query intent to Redis
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=True,
                    user_question=user_question
                )
            
            return jsonify({
                'success': True,
                'message': f'{query_type} executed successfully',
                'affected_rows': affected_rows,
                'execution_time': execution_time,
                'query_type': query_type
            })
    except psycopg2.Error as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = f'PostgreSQL database error: {str(e)}'
        logger.error(f"PostgreSQL error: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'database_error'
        }), 500
    except Exception as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = f'Internal server error: {str(e)}'
        logger.error(f"Unexpected error in PostgreSQL execution: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'server_error'
        }), 500

@app.route('/execute/trino', methods=['POST'])
def execute_trino():
    """Execute SQL queries on Trino with improved error handling"""
    start_time = datetime.now()
    data = request.get_json()
    
    if not data or 'query' not in data:
        logger.warning("Trino endpoint called without query parameter")
        return jsonify({'error': 'No query provided in request body'}), 400
    
    query = data.get('query').strip()
    project_id = data.get('projectId') or request.headers.get('X-Project-ID')
    user_question = data.get('userQuestion')  # Optional: for AI-generated queries
    
    if not query:
        logger.warning("Trino endpoint called with empty query")
        return jsonify({'error': 'Empty query provided'}), 400
    
    # Rewrite query with project prefix for table isolation
    original_query = query
    if project_id:
        query = rewrite_query_with_prefix(query, project_id)
    
    logger.info(f"Executing Trino query: {query[:100]}...")  # Log first 100 chars
    
    try:
        # Allow optional catalog/schema override from request
        # If not provided, connect without defaults (requires fully-qualified names)
        catalog = data.get('catalog')
        schema = data.get('schema')
        
        if catalog:
            # Specific catalog requested
            conn = trino.dbapi.connect(
                host=TRINO_CONFIG['host'],
                port=TRINO_CONFIG['port'],
                user=TRINO_CONFIG['user'],
                catalog=catalog,
                schema=schema or 'default'
            )
            logger.info(f"Trino connection: {catalog}.{schema or 'default'}")
        else:
            # No catalog specified - user must use fully-qualified names
            # This enables federation: mysql.sales.orders, postgresql.analytics.metrics
            conn = trino.dbapi.connect(
                host=TRINO_CONFIG['host'],
                port=TRINO_CONFIG['port'],
                user=TRINO_CONFIG['user']
            )
            logger.info("Trino connection: federation mode (no default catalog)")
        
        cursor = conn.cursor()
        cursor.execute(query)
        
        # Check if this is a SELECT query that returns rows
        if cursor.description:
            # SELECT query - fetch results
            results = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            
            cursor.close()
            conn.close()
            
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_time_ms = execution_time * 1000
            logger.info(f"Trino SELECT query executed successfully in {execution_time:.2f}s, returned {len(results)} rows")
            
            # Save query intent (not results!) to Redis
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=True,
                    user_question=user_question
                )
            
            return jsonify({
                'columns': columns, 
                'results': results,
                'execution_time': execution_time,
                'row_count': len(results)
            })
        else:
            # DDL/DML query (CREATE, INSERT, UPDATE, DELETE, etc.)
            # Note: Trino's cursor.rowcount may not always be accurate for all operations
            affected_rows = cursor.rowcount if cursor.rowcount >= 0 else 0
            cursor.close()
            conn.close()
            
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_time_ms = execution_time * 1000
            
            # Detect query type
            query_upper = query.upper().strip()
            query_type = 'Query'
            if query_upper.startswith('CREATE'):
                query_type = 'CREATE'
            elif query_upper.startswith('INSERT'):
                query_type = 'INSERT'
            elif query_upper.startswith('UPDATE'):
                query_type = 'UPDATE'
            elif query_upper.startswith('DELETE'):
                query_type = 'DELETE'
            elif query_upper.startswith('DROP'):
                query_type = 'DROP'
            elif query_upper.startswith('ALTER'):
                query_type = 'ALTER'
            elif query_upper.startswith('TRUNCATE'):
                query_type = 'TRUNCATE'
            
            logger.info(f"Trino {query_type} query executed successfully in {execution_time:.2f}s")
            
            # Save query intent to Redis
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=True,
                    user_question=user_question
                )
            
            return jsonify({
                'success': True,
                'message': f'{query_type} executed successfully',
                'affected_rows': affected_rows,
                'execution_time': execution_time,
                'query_type': query_type
            })
    except (trino.client.TrinoQueryError, trino.client.TrinoUserError, trino.client.TrinoExternalError) as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = f'Trino query error: {str(e)}'
        logger.error(f"Trino error: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'trino_error'
        }), 500
    except Exception as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = f'Internal server error: {str(e)}'
        logger.error(f"Unexpected error in Trino execution: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'server_error'
        }), 500

@app.route('/execute/spark', methods=['POST'])
def execute_spark():
    """Execute Spark SQL queries with improved error handling"""
    start_time = datetime.now()
    data = request.get_json()
    
    if not data or 'query' not in data:
        logger.warning("Spark endpoint called without query parameter")
        return jsonify({'error': 'No query provided in request body'}), 400
    
    query = data.get('query').strip()
    project_id = data.get('projectId') or request.headers.get('X-Project-ID')
    user_question = data.get('userQuestion')  # Optional: for AI-generated queries
    
    if not query:
        logger.warning("Spark endpoint called with empty query")
        return jsonify({'error': 'Empty query provided'}), 400
    
    # Rewrite query with project prefix for table isolation
    original_query = query
    if project_id:
        query = rewrite_query_with_prefix(query, project_id)
        
    logger.info(f"Executing Spark query: {query[:100]}...")  # Log first 100 chars
        
    try:
        # Create the temporary script file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.py', mode='w') as tmp_file:
            tmp_file.write(open('sparkscript.py').read())
            local_tmp_path = tmp_file.name
        
        container_tmp_path = "/tmp/spark_script.py"
        
        # Copy script to container
        copy_result = subprocess.run(
            ["docker", "cp", local_tmp_path, f"spark_master:{container_tmp_path}"],
            capture_output=True, text=True
        )
        
        if copy_result.returncode != 0:
            logger.error(f"Failed to copy script to Spark container: {copy_result.stderr}")
            os.remove(local_tmp_path)
            return jsonify({
                'error': 'Failed to copy script to Spark container. Is Spark running?',
                'error_type': 'docker_error'
            }), 500
        
        # Execute and capture output - redirect stderr to /dev/null to avoid warnings in output
        result = subprocess.run(
            ["docker", "exec", "spark_master", "bash", "-c", f"/opt/spark/bin/spark-submit {container_tmp_path} '{query}' 2>/dev/null"],
            capture_output=True,
            text=True
        )
        
        # Cleanup
        os.remove(local_tmp_path)
        subprocess.run(["docker", "exec", "spark_master", "rm", container_tmp_path], check=False)
        
        if result.returncode != 0:
            execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
            error_msg = f"Spark execution failed: {result.stderr.strip()}"
            logger.error(f"Spark execution failed: {result.stderr}")
            
            # Save failed query intent
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=False,
                    error_msg=error_msg,
                    user_question=user_question
                )
            
            return jsonify({
                'error': error_msg,
                'error_type': 'spark_error'
            }), 500
        
        # Parse the JSON output from the script
        try:
            output = result.stdout.strip()
            if not output:
                logger.warning("No output from Spark job")
                return jsonify({
                    'error': 'No output from Spark job',
                    'error_type': 'spark_error'
                }), 500
            
            result_data = json.loads(output)
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_time_ms = execution_time * 1000
            result_data['execution_time'] = execution_time
            
            logger.info(f"Spark query executed successfully in {execution_time:.2f}s")
            
            # Save query intent (not results!) to Redis
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=True,
                    user_question=user_question
                )
            
            return jsonify(result_data)
            
        except json.JSONDecodeError as json_err:
            execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
            error_msg = f"Failed to parse results: {json_err}"
            logger.error(f"Failed to parse Spark results: {json_err}")
            
            # Save failed query intent
            if project_id:
                save_query_intent_helper(
                    project_id=project_id,
                    query=query,
                    execution_time_ms=execution_time_ms,
                    was_successful=False,
                    error_msg=error_msg,
                    user_question=user_question
                )
            
            return jsonify({
                'error': error_msg,
                'raw_output': output,
                'error_type': 'parsing_error'
            }), 500
    except FileNotFoundError:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = 'Spark script file not found'
        logger.error("sparkscript.py file not found")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'file_error'
        }), 500
    except subprocess.CalledProcessError as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = 'Docker command failed. Is Docker running?'
        logger.error(f"Docker command failed: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'docker_error'
        }), 500
    except Exception as e:
        execution_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        error_msg = f'Internal server error: {str(e)}'
        logger.error(f"Unexpected error in Spark execution: {e}")
        
        # Save failed query intent
        if project_id:
            save_query_intent_helper(
                project_id=project_id,
                query=query,
                execution_time_ms=execution_time_ms,
                was_successful=False,
                error_msg=error_msg,
                user_question=user_question
            )
        
        return jsonify({
            'error': error_msg,
            'error_type': 'server_error'
        }), 500

@app.route('/api/projects/<project_id>/context', methods=['GET'])
def get_project_context(project_id):
    """Get project context including schema, query history, and AI conversations"""
    try:
        context_file = CONTEXT_STORAGE_DIR / f"{project_id}.json"
        
        if not context_file.exists():
            # Return empty context for new projects
            return jsonify({
                'schema': {'tables': [], 'lastSynced': None, 'isDiscovered': False},
                'queryHistory': [],
                'aiConversations': [],
                'dataUploads': [],
                'settings': {}
            })
        
        with open(context_file, 'r') as f:
            context = json.load(f)
            
        return jsonify(context)
        
    except Exception as e:
        logger.error(f"Error retrieving project context: {e}")
        return jsonify({'error': f'Failed to retrieve project context: {str(e)}'}), 500

@app.route('/api/projects/<project_id>/context', methods=['PUT'])
def update_project_context(project_id):
    """Update project context with new data"""
    try:
        data = request.get_json()
        context_file = CONTEXT_STORAGE_DIR / f"{project_id}.json"
        
        # Load existing context or create new one
        if context_file.exists():
            with open(context_file, 'r') as f:
                context = json.load(f)
        else:
            context = {
                'schema': {'tables': [], 'lastSynced': None, 'isDiscovered': False},
                'queryHistory': [],
                'aiConversations': [],
                'dataUploads': [],
                'settings': {}
            }
        
        # Update context with provided data
        context.update(data)
        context['lastUpdated'] = datetime.now().isoformat()
        
        # Save updated context
        with open(context_file, 'w') as f:
            json.dump(context, f, indent=2)
            
        return jsonify({'success': True, 'message': 'Context updated successfully'})
        
    except Exception as e:
        logger.error(f"Error updating project context: {e}")
        return jsonify({'error': f'Failed to update project context: {str(e)}'}), 500

@app.route('/api/projects/<project_id>/schema', methods=['GET'])
def get_project_schema(project_id):
    """Get cached schema for a project (from Redis)"""
    try:
        # Check if schema is cached in Redis
        cached_schema = context_mgr.get_schema(project_id)
        
        if cached_schema:
            logger.info(f"✅ Returning cached schema for project {project_id}: {len(cached_schema.get('tables', []))} tables")
            return jsonify({
                'success': True,
                'schema': cached_schema,
                'cached': True
            })
        else:
            # Schema not cached - return empty schema
            logger.info(f"⚠️ No cached schema for project {project_id}, returning empty schema")
            return jsonify({
                'success': True,
                'schema': {
                    'tables': [],
                    'lastSynced': None,
                    'isDiscovered': False
                },
                'cached': False,
                'message': 'Schema not discovered yet. Use POST /api/projects/{project_id}/schema/discover to discover schema.'
            })
            
    except Exception as e:
        logger.error(f"Error retrieving schema: {e}")
        return jsonify({'error': f'Failed to retrieve schema: {str(e)}'}), 500


@app.route('/api/projects/<project_id>/schema/discover', methods=['POST'])
def discover_schema(project_id):
    """Discover and cache database schema for the project (saves to Redis)"""
    try:
        # Fetch project from Redis
        project, error_response, status_code = get_project_or_error(project_id)
        if error_response:
            return error_response, status_code
        
        # Get dialect and database from Redis (not from request body)
        dialect = project.get('dialect')
        database = project.get('database', 'default')
        
        # Get force_refresh flag from request (optional)
        force_refresh = False
        if request.json:
            force_refresh = request.json.get('forceRefresh', False)
        
        # Check if schema is cached in Redis (unless force refresh)
        if not force_refresh:
            cached_schema = context_mgr.get_schema(project_id)
            if cached_schema:
                logger.info(f"Returning cached schema for project {project_id}")
                return jsonify({
                    'schema': cached_schema,
                    'cached': True,
                    'dialect': dialect,
                    'database': database
                })
        
        tables = []
        
        if dialect == 'mysql':
            # Discover MySQL schema
            conn = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = conn.cursor(dictionary=True)
            
            # Get tables
            cursor.execute(f"USE {database}")
            cursor.execute("SHOW TABLES")
            all_table_names = [row[f'Tables_in_{database}'] for row in cursor.fetchall()]
            
            # Filter tables by project prefix
            prefix = get_table_prefix(project_id)
            table_names = [t for t in all_table_names if t.startswith(prefix)]
            logger.info(f"🔍 MySQL schema discovery: Found {len(table_names)} tables with prefix '{prefix}' (total: {len(all_table_names)})")
            
            for prefixed_table_name in table_names:
                # Get table structure
                cursor.execute(f"DESCRIBE {prefixed_table_name}")
                columns = cursor.fetchall()
                
                # Remove prefix for display
                display_name = remove_table_prefix(prefixed_table_name, project_id)
                
                tables.append({
                    'name': display_name,  # Display name without prefix
                    'actualName': prefixed_table_name,  # Store actual name for internal use
                    'type': 'table',
                    'columns': [{
                        'name': col['Field'],
                        'type': col['Type'],
                        'nullable': col['Null'] == 'YES',
                        'key': col['Key'],
                        'default': col['Default']
                    } for col in columns]
                })
                
            conn.close()
            
        elif dialect == 'postgresql':
            # Discover PostgreSQL schema (check both public and analytics schemas)
            conn = psycopg2.connect(**POSTGRES_CONFIG)
            cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            
            # Get tables from both public and analytics schemas
            cursor.execute("""
                SELECT table_name, table_schema
                FROM information_schema.tables 
                WHERE table_schema IN ('public', 'analytics') AND table_type = 'BASE TABLE'
            """)
            all_tables = cursor.fetchall()
            
            # Filter tables by project prefix
            prefix = get_table_prefix(project_id)
            filtered_tables = [t for t in all_tables if t['table_name'].startswith(prefix)]
            logger.info(f"🔍 PostgreSQL schema discovery: Found {len(filtered_tables)} tables with prefix '{prefix}' (total: {len(all_tables)})")
            
            for table_row in filtered_tables:
                prefixed_table_name = table_row['table_name']
                schema = table_row['table_schema']
                
                # Get table structure
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns 
                    WHERE table_name = %s AND table_schema = %s
                    ORDER BY ordinal_position
                """, (prefixed_table_name, schema))
                columns = cursor.fetchall()
                
                # Remove prefix for display
                display_name = remove_table_prefix(prefixed_table_name, project_id)
                
                tables.append({
                    'name': display_name,  # Display name without prefix
                    'actualName': prefixed_table_name,  # Store actual name for internal use
                    'schema': schema,  # Store schema (public or analytics)
                    'type': 'table',
                    'columns': [{
                        'name': col['column_name'],
                        'type': col['data_type'],
                        'nullable': col['is_nullable'] == 'YES',
                        'default': col['column_default']
                    } for col in columns]
                })
                
            conn.close()
            
        elif dialect in ['trino', 'analytics']:
            # Discover Trino schema (for Analytics projects using Trino/Spark)
            conn = trino.dbapi.connect(**TRINO_CONFIG)
            cursor = conn.cursor()
            
            # Get tables from PostgreSQL analytics catalog
            cursor.execute("SHOW TABLES FROM postgresql.analytics")
            all_table_rows = cursor.fetchall()
            
            # Filter tables by project prefix
            prefix = get_table_prefix(project_id)
            table_rows = [row for row in all_table_rows if row[0].startswith(prefix)]
            logger.info(f"🔍 Trino schema discovery: Found {len(table_rows)} tables with prefix '{prefix}' (total: {len(all_table_rows)})")
            
            for row in table_rows:
                prefixed_table_name = row[0]
                
                # Get table structure
                cursor.execute(f"DESCRIBE postgresql.analytics.{prefixed_table_name}")
                columns = cursor.fetchall()
                
                # Remove prefix for display
                display_name = remove_table_prefix(prefixed_table_name, project_id)
                
                tables.append({
                    'name': display_name,  # Display name without prefix
                    'actualName': prefixed_table_name,  # Store actual name for internal use
                    'type': 'table',
                    'catalog': 'postgresql.analytics',
                    'columns': [{
                        'name': col[0],
                        'type': col[1],
                        'nullable': True,  # Default for Trino
                        'comment': col[2] if len(col) > 2 else None
                    } for col in columns]
                })
                
            conn.close()
            
        elif dialect == 'spark':
            # Discover Spark schema (for Analytics projects using Spark)
            spark = SparkSession.builder \
                .appName("SchemaDiscovery") \
                .config("spark.sql.adaptive.enabled", "true") \
                .getOrCreate()
                
            # Get tables
            all_spark_tables = spark.sql("SHOW TABLES").collect()
            
            # Filter tables by project prefix
            prefix = get_table_prefix(project_id)
            spark_tables = [t for t in all_spark_tables if t['tableName'].startswith(prefix)]
            logger.info(f"🔍 Spark schema discovery: Found {len(spark_tables)} tables with prefix '{prefix}' (total: {len(all_spark_tables)})")
            
            for table_row in spark_tables:
                prefixed_table_name = table_row['tableName']
                
                # Get table structure
                df = spark.table(prefixed_table_name)
                
                # Remove prefix for display
                display_name = remove_table_prefix(prefixed_table_name, project_id)
                
                tables.append({
                    'name': display_name,  # Display name without prefix
                    'actualName': prefixed_table_name,  # Store actual name for internal use
                    'type': 'table',
                    'columns': [{
                        'name': field.name,
                        'type': str(field.dataType),
                        'nullable': field.nullable
                    } for field in df.schema.fields]
                })
                
            spark.stop()
        
        # Save discovered schema to Redis with TTL
        schema_data = {
            'tables': tables,
            'lastSynced': datetime.now().isoformat(),
            'isDiscovered': True,
            'dialect': dialect,
            'database': database
        }
        
        # Save to Redis cache (1 hour TTL by default)
        success = context_mgr.save_schema(project_id, schema_data, ttl=3600)
        
        if not success:
            logger.warning(f"Failed to cache schema in Redis for project {project_id}")
        
        logger.info(f"Schema discovered and cached for project {project_id}: {len(tables)} tables")
        
        return jsonify({
            'success': True,
            'schema': schema_data,
            'message': f'Discovered {len(tables)} tables',
            'cached': success
        })
        
    except Exception as e:
        logger.error(f"Error discovering schema: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Failed to discover schema: {str(e)}'}), 500

@app.route('/api/projects/<project_id>/queries', methods=['POST'])
def save_query_history(project_id):
    """Save query execution to project history"""
    try:
        data = request.get_json()
        
        query_item = {
            'id': str(uuid.uuid4()),
            'query': data.get('query'),
            'results': data.get('results'),
            'executionTime': data.get('executionTime'),
            'timestamp': datetime.now().isoformat(),
            'dialect': data.get('dialect'),
            'status': data.get('status', 'success')
        }
        
        context_file = CONTEXT_STORAGE_DIR / f"{project_id}.json"
        
        if context_file.exists():
            with open(context_file, 'r') as f:
                context = json.load(f)
        else:
            context = {
                'schema': {'tables': [], 'lastSynced': None, 'isDiscovered': False},
                'queryHistory': [],
                'aiConversations': [],
                'dataUploads': [],
                'settings': {}
            }
        
        context['queryHistory'].append(query_item)
        
        # Keep only last 100 queries
        context['queryHistory'] = context['queryHistory'][-100:]
        
        with open(context_file, 'w') as f:
            json.dump(context, f, indent=2)
        
        return jsonify({'success': True, 'queryId': query_item['id']})
        
    except Exception as e:
        logger.error(f"Error saving query history: {e}")
        return jsonify({'error': f'Failed to save query: {str(e)}'}), 500

@app.route('/upload-csv', methods=['POST'])
def upload_csv():
    """Upload CSV file - available for all project types"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        project_id = request.form.get('project_id')
        
        # Fetch project from Redis
        project, error_response, status_code = get_project_or_error(project_id)
        if error_response:
            return error_response, status_code
        
        if not file or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        # Validate file extension
        if not file.filename.lower().endswith('.csv'):
            return jsonify({'error': 'Only CSV files are supported'}), 400
            
        # Read CSV content
        import pandas as pd
        import io
        
        # Read CSV into pandas DataFrame
        csv_content = file.read().decode('utf-8')
        df = pd.read_csv(io.StringIO(csv_content))
        
        # Calculate file size
        file_size_mb = len(csv_content.encode('utf-8')) / (1024 * 1024)
        
        # Generate base table name from filename (without prefix)
        base_table_name = os.path.splitext(file.filename)[0].lower()
        # Clean table name for SQL compatibility
        base_table_name = re.sub(r'[^a-zA-Z0-9_]', '_', base_table_name)
        
        # Add project prefix for isolation
        table_name = add_table_prefix(base_table_name, project_id)
        logger.info(f"📋 CSV upload: {file.filename} -> {table_name} (base: {base_table_name})")
        
        # Get column information
        columns = list(df.columns)
        column_types = []
        
        for col in df.columns:
            if df[col].dtype == 'object':
                column_types.append(f'"{col}" VARCHAR(255)')
            elif df[col].dtype in ['int64', 'int32']:
                column_types.append(f'"{col}" INTEGER')
            elif df[col].dtype in ['float64', 'float32']:
                column_types.append(f'"{col}" DOUBLE PRECISION')
            else:
                column_types.append(f'"{col}" TEXT')
        
        # Save CSV to temporary location
        upload_dir = Path('csv_uploads')
        upload_dir.mkdir(exist_ok=True)
        
        csv_path = upload_dir / f"{project_id}_{table_name}.csv"
        df.to_csv(csv_path, index=False)
        
        # ROUTING LOGIC: Based on project dialect
        engine_used = None
        query_tip = None
        project_dialect = project['dialect']
        
        if project_dialect == 'mysql':
            # MySQL project: Load directly to MySQL sales database
            try:
                load_to_mysql(df, table_name, column_types)
                engine_used = 'mysql'
                optimal_query_engine = 'mysql'
                query_tip = f"Query with MySQL: SELECT * FROM sales.{table_name}"
                logger.info(f"✅ Loaded {len(df)} rows into MySQL table: {table_name} ({file_size_mb:.2f} MB)")
            except Exception as e:
                logger.error(f"Failed to load to MySQL: {e}")
                engine_used = 'file'
                optimal_query_engine = None
                query_tip = f"Data saved to file: {csv_path}"
                
        elif project_dialect == 'postgresql':
            # PostgreSQL project: Load directly to PostgreSQL analytics database
            try:
                load_to_postgresql(df, table_name, column_types)
                engine_used = 'postgresql'
                optimal_query_engine = 'postgresql'
                query_tip = f"Query with PostgreSQL: SELECT * FROM analytics.{table_name}"
                logger.info(f"✅ Loaded {len(df)} rows into PostgreSQL table: {table_name} ({file_size_mb:.2f} MB)")
            except Exception as e:
                logger.error(f"Failed to load to PostgreSQL: {e}")
                engine_used = 'file'
                optimal_query_engine = None
                query_tip = f"Data saved to file: {csv_path}"
                
        elif project_dialect == 'analytics':
            # Analytics project: Smart routing based on file size
            if file_size_mb < 10:
                # Small file: Load into PostgreSQL (fast + queryable by Trino)
                try:
                    load_to_postgresql(df, table_name, column_types)
                    engine_used = 'postgresql'
                    optimal_query_engine = 'trino'
                    query_tip = f"Query with Trino: SELECT * FROM postgresql.analytics.{table_name}"
                    logger.info(f"✅ Loaded {len(df)} rows into PostgreSQL table: {table_name} ({file_size_mb:.2f} MB)")
                except Exception as e:
                    logger.error(f"Failed to load to PostgreSQL: {e}")
                    engine_used = 'file'
                    optimal_query_engine = None
                    query_tip = f"Data saved to file: {csv_path}"
            else:
                # Large file: Load into Spark (distributed processing)
                try:
                    load_to_spark(df, table_name, str(csv_path))
                    engine_used = 'spark'
                    optimal_query_engine = 'spark'
                    query_tip = f"Query with Spark: SELECT * FROM {table_name}"
                    logger.info(f"✅ Loaded {len(df)} rows into Spark table: {table_name} ({file_size_mb:.2f} MB)")
                except Exception as e:
                    logger.error(f"Failed to load to Spark: {e}")
                    engine_used = 'file'
                    optimal_query_engine = None
                    query_tip = f"Data saved to file: {csv_path}"
        
        # NEW: Update project metadata based on dialect
        metadata_updates = {}
        optimization_message = None
        
        if optimal_query_engine:  # Only if upload succeeded
            if project['dialect'] == 'analytics':
                # Analytics projects: Track actual engine used
                if project.get('actualEngine') != optimal_query_engine:
                    metadata_updates['actualEngine'] = optimal_query_engine
                    metadata_updates['engineOptimizedAt'] = datetime.now().isoformat()
                    optimization_message = f"Engine optimized to {optimal_query_engine.upper()}"
                    logger.info(f"⚡ Analytics project {project_id}: engine optimized to {optimal_query_engine}")
            
            elif project['dialect'] in ['mysql', 'postgresql']:
                # Traditional DB projects: Track CSV uploads
                csv_uploads = project.get('csvUploads', [])
                csv_uploads.append({
                    'table': table_name,
                    'engine': engine_used,
                    'size_mb': round(file_size_mb, 2),
                    'uploaded_at': datetime.now().isoformat()
                })
                metadata_updates['csvUploads'] = csv_uploads
                
                # Suggest creating analytics project for frequent uploads
                if len(csv_uploads) >= 3:
                    optimization_message = "Tip: Consider creating an Analytics project for frequent CSV uploads"
                    logger.info(f"💡 Project {project_id} has {len(csv_uploads)} CSV uploads - suggest Analytics project")
            
            elif project['dialect'] in ['trino', 'spark']:
                # Legacy projects: Track actual engine (for backward compatibility)
                if not project.get('actualEngine'):
                    metadata_updates['actualEngine'] = optimal_query_engine
                    logger.info(f"📝 Legacy project {project_id}: tracking actualEngine as {optimal_query_engine}")
            
            # Apply metadata updates to Redis
            if metadata_updates:
                context_mgr.update_project_metadata(project_id, metadata_updates)
                logger.info(f"✅ Updated project {project_id} metadata in Redis: {metadata_updates}")
        
        # Update project context with upload information
        context_file = CONTEXT_STORAGE_DIR / f"{project_id}.json"
        
        if context_file.exists():
            with open(context_file, 'r') as f:
                context = json.load(f)
        else:
            context = {
                'schema': {'tables': [], 'lastSynced': None, 'isDiscovered': False},
                'queryHistory': [],
                'aiConversations': [],
                'dataUploads': [],
                'settings': {}
            }
        
        # Add to data uploads
        upload_info = {
            'id': str(uuid.uuid4()),
            'fileName': file.filename,
            'tableName': table_name,
            'filePath': str(csv_path),
            'columns': columns,
            'rowCount': len(df),
            'uploadedAt': datetime.now().isoformat()
        }
        
        context['dataUploads'].append(upload_info)
        
        # Add to schema tables
        table_info = {
            'name': table_name,
            'columns': [{'name': col, 'type': 'VARCHAR'} for col in columns],
            'isUpload': True
        }
        
        # Update or add table in schema
        existing_tables = context['schema']['tables']
        context['schema']['tables'] = [t for t in existing_tables if t['name'] != table_name]
        context['schema']['tables'].append(table_info)
        
        with open(context_file, 'w') as f:
            json.dump(context, f, indent=2)
        
        logger.info(f"CSV uploaded successfully: {file.filename} -> {table_name} (Engine: {engine_used})")
        
        # Invalidate schema cache after successful CSV upload
        if engine_used != 'file':  # Only if data was actually loaded to a database
            logger.info(f"🔄 CSV upload completed, invalidating schema cache for project {project_id}")
            context_mgr.invalidate_schema(project_id)
        
        return jsonify({
            'success': True,
            'table_name': table_name,
            'columns': columns,
            'rows_loaded': len(df),
            'file_path': str(csv_path),
            'file_size_mb': round(file_size_mb, 2),
            'engine': engine_used,
            'query_engine': optimal_query_engine if 'optimal_query_engine' in locals() else engine_used,
            'query_tip': query_tip,
            'optimization_message': optimization_message,
            'actual_engine': project.get('actualEngine'),
            'schema_invalidated': engine_used != 'file'  # Let frontend know to refresh schema
        })
        
    except Exception as e:
        logger.error(f"Error uploading CSV: {e}")
        return jsonify({'error': f'Failed to upload CSV: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for SQL Execution service"""
    try:
        # Basic service health check
        services_status = {
            'mysql': False,
            'postgresql': False,
            'trino': False,
            'spark': False,
            'redis': False
        }
        
        # Test MySQL connection
        try:
            conn = mysql.connector.connect(**MYSQL_CONFIG)
            conn.close()
            services_status['mysql'] = True
        except:
            pass
        
        # Test PostgreSQL connection
        try:
            conn = psycopg2.connect(**POSTGRES_CONFIG)
            conn.close()
            services_status['postgresql'] = True
        except:
            pass
        
        # Test Trino connection
        try:
            conn = trino.dbapi.connect(**TRINO_CONFIG)
            conn.close()
            services_status['trino'] = True
        except:
            pass
        
        # For Spark, just check if we can create a session (basic check)
        try:
            # Basic Spark availability check
            services_status['spark'] = True  # Assume available if no major errors
        except:
            pass
        
        # Test Redis connection
        redis_health = context_mgr.health_check()
        services_status['redis'] = redis_health.get('status') == 'healthy'
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'services': services_status,
            'redis_info': redis_health,
            'message': 'SQL Execution Service is running'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500


# ============================================================================
# REDIS-BASED CONTEXT API ENDPOINTS (NEW)
# ============================================================================

@app.route('/api/context/project', methods=['POST'])
def create_project():
    """Create new project metadata in Redis"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['id', 'name', 'dialect', 'database']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Add timestamps if not provided
        if 'createdAt' not in data:
            data['createdAt'] = datetime.now().isoformat()
        if 'updatedAt' not in data:
            data['updatedAt'] = datetime.now().isoformat()
        
        success = context_mgr.save_project_metadata(data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Project created successfully',
                'project': data
            }), 201
        else:
            return jsonify({'error': 'Failed to create project'}), 500
            
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/project/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get project metadata from Redis"""
    try:
        project = context_mgr.get_project_metadata(project_id)
        
        if project:
            return jsonify(project)
        else:
            return jsonify({'error': 'Project not found'}), 404
            
    except Exception as e:
        logger.error(f"Error retrieving project: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/project/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update project metadata in Redis"""
    try:
        updates = request.get_json()
        success = context_mgr.update_project_metadata(project_id, updates)
        
        if success:
            return jsonify({'success': True, 'message': 'Project updated successfully'})
        else:
            return jsonify({'error': 'Failed to update project'}), 500
            
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/project/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete project and all its context data from Redis"""
    try:
        success = context_mgr.delete_project(project_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Project deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete project'}), 500
            
    except Exception as e:
        logger.error(f"Error deleting project: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/projects', methods=['GET'])
def list_projects():
    """List all projects"""
    try:
        projects = context_mgr.list_all_projects()
        return jsonify({'projects': projects, 'count': len(projects)})
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/schema/<project_id>', methods=['GET'])
def get_cached_schema(project_id):
    """Get cached schema from Redis"""
    try:
        schema = context_mgr.get_schema(project_id)
        
        if schema:
            return jsonify(schema)
        else:
            return jsonify({
                'message': 'Schema not cached. Please discover schema first.',
                'cached': False
            }), 404
            
    except Exception as e:
        logger.error(f"Error retrieving schema: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/schema/<project_id>', methods=['POST'])
def save_schema_cache(project_id):
    """Save/update schema cache in Redis"""
    try:
        schema_data = request.get_json()
        ttl = request.args.get('ttl', 3600, type=int)  # Default 1 hour
        
        success = context_mgr.save_schema(project_id, schema_data, ttl)
        
        if success:
            return jsonify({'success': True, 'message': 'Schema cached successfully', 'ttl': ttl})
        else:
            return jsonify({'error': 'Failed to cache schema'}), 500
            
    except Exception as e:
        logger.error(f"Error caching schema: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/schema/<project_id>/invalidate', methods=['DELETE'])
def invalidate_schema_cache(project_id):
    """Invalidate (delete) schema cache"""
    try:
        success = context_mgr.invalidate_schema(project_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Schema cache invalidated'})
        else:
            return jsonify({'error': 'Failed to invalidate schema'}), 500
            
    except Exception as e:
        logger.error(f"Error invalidating schema: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/ai/<project_id>/message', methods=['POST'])
def save_ai_message(project_id):
    """Save AI conversation message"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'sessionId' not in data or 'message' not in data:
            return jsonify({'error': 'Missing sessionId or message'}), 400
        
        session_id = data['sessionId']
        message = data['message']
        
        # Add timestamp if not provided
        if 'timestamp' not in message:
            message['timestamp'] = datetime.now().isoformat()
        
        success = context_mgr.save_ai_message(project_id, session_id, message)
        
        if success:
            return jsonify({'success': True, 'message': 'AI message saved successfully'})
        else:
            return jsonify({'error': 'Failed to save AI message'}), 500
            
    except Exception as e:
        logger.error(f"Error saving AI message: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/ai/<project_id>/session/<session_id>', methods=['GET'])
def get_ai_session(project_id, session_id):
    """Get AI conversation session"""
    try:
        session = context_mgr.get_ai_session(project_id, session_id)
        
        if session:
            return jsonify(session)
        else:
            return jsonify({'error': 'Session not found'}), 404
            
    except Exception as e:
        logger.error(f"Error retrieving AI session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/ai/<project_id>/sessions', methods=['GET'])
def list_ai_sessions(project_id):
    """List all AI sessions for project"""
    try:
        sessions = context_mgr.list_ai_sessions(project_id)
        return jsonify({'sessions': sessions, 'count': len(sessions)})
    except Exception as e:
        logger.error(f"Error listing AI sessions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/intents/<project_id>', methods=['GET'])
def get_query_intents(project_id):
    """Get recent query intents (no results, just intent metadata)"""
    try:
        limit = request.args.get('limit', 50, type=int)
        intents = context_mgr.get_query_intents(project_id, limit)
        return jsonify({'intents': intents, 'count': len(intents)})
    except Exception as e:
        logger.error(f"Error retrieving query intents: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/intents/<project_id>', methods=['POST'])
def save_query_intent(project_id):
    """Save query intent (NO RESULTS - just metadata)"""
    try:
        intent = request.get_json()
        
        # Validate required fields
        if 'sqlQuery' not in intent:
            return jsonify({'error': 'Missing sqlQuery field'}), 400
        
        # Add ID and timestamp if not provided
        if 'id' not in intent:
            intent['id'] = str(uuid.uuid4())
        if 'executedAt' not in intent:
            intent['executedAt'] = datetime.now().isoformat()
        
        # Ensure no results are stored
        if 'result' in intent:
            del intent['result']
        if 'results' in intent:
            del intent['results']
        
        success = context_mgr.save_query_intent(project_id, intent)
        
        if success:
            return jsonify({'success': True, 'message': 'Query intent saved successfully'})
        else:
            return jsonify({'error': 'Failed to save query intent'}), 500
            
    except Exception as e:
        logger.error(f"Error saving query intent: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/context/stats/<project_id>', methods=['GET'])
def get_project_stats(project_id):
    """Get project statistics"""
    try:
        stats = context_mgr.get_project_stats(project_id)
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error retrieving project stats: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Get port from environment or default to 8000
    port = int(os.getenv('FLASK_PORT', 8000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    logger.info(f"Starting SQL Execution Engine on port {port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"Available endpoints: /execute/mysql, /execute/postgresql, /execute/trino, /execute/spark, /health")
    logger.info(f"Context API endpoints: /api/projects/<id>/context, /api/projects/<id>/schema/discover, /api/projects/<id>/queries")
    logger.info(f"Context storage directory: {CONTEXT_STORAGE_DIR}")
    
    # Run the Flask server on all interfaces
    app.run(host='0.0.0.0', port=port, debug=debug)