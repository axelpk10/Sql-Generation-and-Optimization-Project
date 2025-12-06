"""
Query Pattern Analytics Module
Tracks SQL query patterns, complexity, and table access patterns
"""

import sqlite3
import re
import sqlparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class QueryAnalytics:
    """Analytics for SQL query patterns and performance"""
    
    def __init__(self, db_path: str = "query_analytics.db"):
        self.db_path = Path(db_path)
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for query analytics"""
        with sqlite3.connect(self.db_path) as conn:
            # Query patterns table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS query_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT,
                    query_hash TEXT,
                    query_type TEXT,
                    query_text TEXT,
                    execution_time_ms REAL,
                    was_successful BOOLEAN,
                    error_message TEXT,
                    tables_accessed TEXT,
                    join_count INTEGER,
                    subquery_count INTEGER,
                    aggregate_functions TEXT,
                    has_where_clause BOOLEAN,
                    has_group_by BOOLEAN,
                    has_order_by BOOLEAN,
                    complexity_score INTEGER,
                    timestamp DATETIME
                )
            """)
            
            # Table access patterns
            conn.execute("""
                CREATE TABLE IF NOT EXISTS table_access (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT,
                    table_name TEXT,
                    access_type TEXT,
                    access_count INTEGER DEFAULT 1,
                    last_accessed DATETIME,
                    avg_execution_time_ms REAL
                )
            """)
            
            # Create indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_query_timestamp ON query_patterns(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_query_project ON query_patterns(project_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_query_type ON query_patterns(query_type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_table_project ON table_access(project_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_table_name ON table_access(table_name)")
    
    def classify_query_type(self, query: str) -> str:
        """Classify query type (SELECT, INSERT, UPDATE, DELETE, DDL)"""
        query_upper = query.strip().upper()
        
        if query_upper.startswith('SELECT'):
            return 'SELECT'
        elif query_upper.startswith('INSERT'):
            return 'INSERT'
        elif query_upper.startswith('UPDATE'):
            return 'UPDATE'
        elif query_upper.startswith('DELETE'):
            return 'DELETE'
        elif any(query_upper.startswith(ddl) for ddl in ['CREATE', 'ALTER', 'DROP', 'TRUNCATE']):
            return 'DDL'
        else:
            return 'OTHER'
    
    def extract_tables(self, query: str) -> List[str]:
        """Extract table names from query"""
        patterns = [
            r'FROM\s+([a-zA-Z0-9_\.]+)',
            r'JOIN\s+([a-zA-Z0-9_\.]+)',
            r'INTO\s+([a-zA-Z0-9_\.]+)',
            r'UPDATE\s+([a-zA-Z0-9_\.]+)',
            r'TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([a-zA-Z0-9_\.]+)',
        ]
        
        tables = set()
        for pattern in patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            tables.update(matches)
        
        return list(tables)
    
    def analyze_query_complexity(self, query: str) -> Dict:
        """Analyze query complexity metrics"""
        query_upper = query.upper()
        
        # Count JOINs
        join_count = len(re.findall(r'\bJOIN\b', query_upper))
        
        # Count subqueries
        subquery_count = query.count('(SELECT')
        
        # Detect aggregate functions
        aggregates = []
        agg_functions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP_CONCAT']
        for func in agg_functions:
            if f'{func}(' in query_upper:
                aggregates.append(func)
        
        # Check clauses
        has_where = 'WHERE' in query_upper
        has_group_by = 'GROUP BY' in query_upper
        has_order_by = 'ORDER BY' in query_upper
        
        # Calculate complexity score (0-100)
        complexity = 0
        complexity += join_count * 10
        complexity += subquery_count * 15
        complexity += len(aggregates) * 5
        complexity += 10 if has_group_by else 0
        complexity += 5 if has_order_by else 0
        complexity += 5 if has_where else 0
        complexity = min(complexity, 100)
        
        return {
            'join_count': join_count,
            'subquery_count': subquery_count,
            'aggregates': aggregates,
            'has_where': has_where,
            'has_group_by': has_group_by,
            'has_order_by': has_order_by,
            'complexity_score': complexity
        }
    
    def log_query_pattern(self, project_id: str, query: str, execution_time_ms: float,
                          was_successful: bool, error_message: Optional[str] = None):
        """Log query execution pattern"""
        try:
            # Classify and analyze
            query_type = self.classify_query_type(query)
            tables = self.extract_tables(query)
            complexity = self.analyze_query_complexity(query)
            
            # Generate query hash (for deduplication)
            import hashlib
            query_hash = hashlib.md5(query.encode()).hexdigest()[:12]
            
            with sqlite3.connect(self.db_path) as conn:
                # Log query pattern
                conn.execute("""
                    INSERT INTO query_patterns
                    (project_id, query_hash, query_type, query_text, execution_time_ms,
                     was_successful, error_message, tables_accessed, join_count, subquery_count,
                     aggregate_functions, has_where_clause, has_group_by, has_order_by,
                     complexity_score, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    project_id, query_hash, query_type, query, execution_time_ms,
                    was_successful, error_message, ','.join(tables), complexity['join_count'],
                    complexity['subquery_count'], ','.join(complexity['aggregates']),
                    complexity['has_where'], complexity['has_group_by'], complexity['has_order_by'],
                    complexity['complexity_score'], datetime.now()
                ))
                
                # Update table access patterns
                if was_successful:
                    for table in tables:
                        conn.execute("""
                            INSERT INTO table_access (project_id, table_name, access_type, access_count, last_accessed, avg_execution_time_ms)
                            VALUES (?, ?, ?, 1, ?, ?)
                            ON CONFLICT(project_id, table_name, access_type) DO UPDATE SET
                                access_count = access_count + 1,
                                last_accessed = ?,
                                avg_execution_time_ms = (avg_execution_time_ms * access_count + ?) / (access_count + 1)
                        """, (project_id, table, query_type, datetime.now(), execution_time_ms,
                              datetime.now(), execution_time_ms))
            
            logger.info(f"📊 Query pattern logged: {query_type} on {len(tables)} tables, complexity={complexity['complexity_score']}")
        
        except Exception as e:
            logger.error(f"Error logging query pattern: {e}")
    
    def get_query_type_distribution(self, project_id: Optional[str] = None, hours: int = 24) -> List[Dict]:
        """Get distribution of query types"""
        since = datetime.now() - timedelta(hours=hours)
        
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT query_type, COUNT(*) as count, AVG(execution_time_ms) as avg_time
                FROM query_patterns
                WHERE timestamp >= ?
            """
            params = [since]
            
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            
            query += " GROUP BY query_type ORDER BY count DESC"
            
            results = conn.execute(query, params).fetchall()
        
        return [{'type': row[0], 'count': row[1], 'avg_time': row[2]} for row in results]
    
    def get_most_accessed_tables(self, project_id: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Get most frequently accessed tables"""
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT table_name, SUM(access_count) as total_accesses,
                       AVG(avg_execution_time_ms) as avg_time, MAX(last_accessed) as last_access
                FROM table_access
            """
            params = []
            
            if project_id:
                query += " WHERE project_id = ?"
                params.append(project_id)
            
            query += " GROUP BY table_name ORDER BY total_accesses DESC LIMIT ?"
            params.append(limit)
            
            results = conn.execute(query, params).fetchall()
        
        return [{'table': row[0], 'accesses': row[1], 'avg_time': row[2], 'last_access': row[3]} 
                for row in results]
    
    def get_complexity_distribution(self, project_id: Optional[str] = None, hours: int = 24) -> List[Dict]:
        """Get distribution of query complexity"""
        since = datetime.now() - timedelta(hours=hours)
        
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT 
                    CASE 
                        WHEN complexity_score < 20 THEN 'Simple'
                        WHEN complexity_score < 50 THEN 'Medium'
                        WHEN complexity_score < 80 THEN 'Complex'
                        ELSE 'Very Complex'
                    END as level,
                    COUNT(*) as count,
                    AVG(execution_time_ms) as avg_time
                FROM query_patterns
                WHERE timestamp >= ?
            """
            params = [since]
            
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            
            query += " GROUP BY level"
            
            results = conn.execute(query, params).fetchall()
        
        return [{'level': row[0], 'count': row[1], 'avg_time': row[2]} for row in results]
    
    def get_performance_stats(self, project_id: Optional[str] = None, hours: int = 24) -> Dict:
        """Get comprehensive query performance statistics"""
        since = datetime.now() - timedelta(hours=hours)
        
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT 
                    COUNT(*) as total_queries,
                    SUM(CASE WHEN was_successful THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
                    AVG(execution_time_ms) as avg_time,
                    AVG(join_count) as avg_joins,
                    AVG(complexity_score) as avg_complexity
                FROM query_patterns
                WHERE timestamp >= ?
            """
            params = [since]
            
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            
            result = conn.execute(query, params).fetchone()
        
        return {
            'total_queries': result[0] or 0,
            'success_rate': result[1] or 0,
            'avg_time': result[2] or 0,
            'avg_joins': result[3] or 0,
            'avg_complexity': result[4] or 0
        }


# Global analytics instance
query_analytics = QueryAnalytics()
