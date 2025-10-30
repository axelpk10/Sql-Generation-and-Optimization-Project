import time
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class QueryMetrics:
    """Query performance and usage metrics"""
    query_id: str
    user_query: str
    response_time: float
    docs_retrieved: int
    tokens_used: int
    cache_hit: bool
    optimization_type: str  # 'generation', 'optimization', 'explanation'
    success: bool
    error_message: Optional[str]
    timestamp: datetime
    user_id: Optional[str] = None

class QueryAnalytics:
    """Advanced analytics for query performance and usage patterns"""
    
    def __init__(self, db_path: str = "query_analytics.db"):
        self.db_path = Path(db_path)
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for analytics"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS query_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_id TEXT UNIQUE,
                    user_query TEXT,
                    response_time REAL,
                    docs_retrieved INTEGER,
                    tokens_used INTEGER,
                    cache_hit BOOLEAN,
                    optimization_type TEXT,
                    success BOOLEAN,
                    error_message TEXT,
                    timestamp DATETIME,
                    user_id TEXT
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_timestamp ON query_metrics(timestamp)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_optimization_type ON query_metrics(optimization_type)
            """)
    
    def log_query(self, metrics: QueryMetrics):
        """Log query metrics to database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO query_metrics 
                (query_id, user_query, response_time, docs_retrieved, tokens_used, 
                 cache_hit, optimization_type, success, error_message, timestamp, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                metrics.query_id, metrics.user_query, metrics.response_time,
                metrics.docs_retrieved, metrics.tokens_used, metrics.cache_hit,
                metrics.optimization_type, metrics.success, metrics.error_message,
                metrics.timestamp, metrics.user_id
            ))
    
    def get_performance_stats(self, hours: int = 24) -> Dict:
        """Get performance statistics for the last N hours"""
        since = datetime.now() - timedelta(hours=hours)
        
        with sqlite3.connect(self.db_path) as conn:
            # Overall stats
            overall = conn.execute("""
                SELECT 
                    COUNT(*) as total_queries,
                    AVG(response_time) as avg_response_time,
                    AVG(docs_retrieved) as avg_docs_retrieved,
                    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as cache_hit_rate,
                    SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
                FROM query_metrics 
                WHERE timestamp >= ?
            """, (since,)).fetchone()
            
            # By optimization type
            by_type = conn.execute("""
                SELECT 
                    optimization_type,
                    COUNT(*) as count,
                    AVG(response_time) as avg_response_time
                FROM query_metrics 
                WHERE timestamp >= ?
                GROUP BY optimization_type
            """, (since,)).fetchall()
            
            # Popular query patterns
            patterns = conn.execute("""
                SELECT 
                    SUBSTR(user_query, 1, 100) as query_pattern,
                    COUNT(*) as frequency,
                    AVG(response_time) as avg_response_time
                FROM query_metrics 
                WHERE timestamp >= ? AND success = 1
                GROUP BY SUBSTR(user_query, 1, 100)
                ORDER BY frequency DESC
                LIMIT 10
            """, (since,)).fetchall()
        
        return {
            'period_hours': hours,
            'overall': dict(zip(['total_queries', 'avg_response_time', 'avg_docs_retrieved', 'cache_hit_rate', 'success_rate'], overall)),
            'by_optimization_type': [dict(zip(['type', 'count', 'avg_response_time'], row)) for row in by_type],
            'popular_patterns': [dict(zip(['pattern', 'frequency', 'avg_response_time'], row)) for row in patterns]
        }
    
    def get_slow_queries(self, threshold: float = 10.0, limit: int = 10) -> List[Dict]:
        """Get slowest queries above threshold"""
        with sqlite3.connect(self.db_path) as conn:
            slow_queries = conn.execute("""
                SELECT user_query, response_time, docs_retrieved, timestamp
                FROM query_metrics 
                WHERE response_time > ? AND success = 1
                ORDER BY response_time DESC
                LIMIT ?
            """, (threshold, limit)).fetchall()
        
        return [dict(zip(['query', 'response_time', 'docs_retrieved', 'timestamp'], row)) for row in slow_queries]
    
    def export_analytics(self, hours: int = 24) -> str:
        """Export analytics as JSON"""
        stats = self.get_performance_stats(hours)
        slow_queries = self.get_slow_queries()
        
        return json.dumps({
            'generated_at': datetime.now().isoformat(),
            'performance_stats': stats,
            'slow_queries': slow_queries
        }, indent=2)