"""
Schema Generation Analytics Module
Advanced analytics for schema generation performance, patterns, and optimization
"""

import time
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import hashlib
import re

@dataclass
class SchemaMetrics:
    """Schema generation performance and quality metrics"""
    schema_id: str
    user_requirements: str
    response_time: float
    docs_retrieved: int
    docs_used: int
    schema_complexity: int  # Number of tables generated
    total_columns: int
    total_constraints: int
    total_indexes: int
    has_foreign_keys: bool
    has_unique_constraints: bool
    has_check_constraints: bool
    schema_size_chars: int
    explanation_size_chars: int
    optimization_size_chars: int
    reranking_model: str
    llm_model: str
    success: bool
    error_message: Optional[str]
    timestamp: datetime
    user_id: Optional[str] = None
    schema_category: Optional[str] = None  # e.g., 'e-commerce', 'blog', 'financial'

@dataclass
class SchemaQualityScore:
    """Schema quality assessment metrics"""
    schema_id: str
    normalization_score: float  # 0-100
    constraint_coverage: float  # 0-100
    indexing_quality: float  # 0-100
    naming_convention: float  # 0-100
    documentation_quality: float  # 0-100
    overall_score: float  # 0-100
    timestamp: datetime

class SchemaAnalytics:
    """Advanced analytics for schema generation performance and quality patterns"""
    
    def __init__(self, db_path: str = "schema_analytics.db"):
        self.db_path = Path(db_path)
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for schema analytics"""
        with sqlite3.connect(self.db_path) as conn:
            # Main metrics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schema_id TEXT UNIQUE,
                    user_requirements TEXT,
                    response_time REAL,
                    docs_retrieved INTEGER,
                    docs_used INTEGER,
                    schema_complexity INTEGER,
                    total_columns INTEGER,
                    total_constraints INTEGER,
                    total_indexes INTEGER,
                    has_foreign_keys BOOLEAN,
                    has_unique_constraints BOOLEAN,
                    has_check_constraints BOOLEAN,
                    schema_size_chars INTEGER,
                    explanation_size_chars INTEGER,
                    optimization_size_chars INTEGER,
                    reranking_model TEXT,
                    llm_model TEXT,
                    dialect TEXT,
                    success BOOLEAN,
                    error_message TEXT,
                    timestamp DATETIME,
                    user_id TEXT,
                    schema_category TEXT
                )
            """)
            
            # Quality scores table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_quality (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schema_id TEXT,
                    normalization_score REAL,
                    constraint_coverage REAL,
                    indexing_quality REAL,
                    naming_convention REAL,
                    documentation_quality REAL,
                    overall_score REAL,
                    timestamp DATETIME,
                    FOREIGN KEY (schema_id) REFERENCES schema_metrics (schema_id)
                )
            """)
            
            # RAG Pipeline Analytics Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rag_analytics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schema_id TEXT,
                    retrieval_time REAL,
                    docs_retrieved INTEGER,
                    avg_retrieval_score REAL,
                    rerank_time REAL,
                    rerank_model TEXT,
                    docs_after_rerank INTEGER,
                    avg_rerank_score REAL,
                    score_improvement REAL,
                    top_doc_sources TEXT,
                    timestamp DATETIME,
                    FOREIGN KEY (schema_id) REFERENCES schema_metrics (schema_id)
                )
            """)
            
            # Performance indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON schema_metrics(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_category ON schema_metrics(schema_category)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_complexity ON schema_metrics(schema_complexity)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_response_time ON schema_metrics(response_time)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_timestamp ON rag_analytics(timestamp)")
    
    def analyze_schema_content(self, schema_content: str) -> Dict:
        """Analyze schema content for complexity metrics"""
        if not schema_content:
            return {
                'tables': 0, 'columns': 0, 'constraints': 0, 'indexes': 0,
                'has_foreign_keys': False, 'has_unique': False, 'has_check': False
            }
        
        # Count SQL elements
        table_count = len(re.findall(r'CREATE TABLE', schema_content, re.IGNORECASE))
        column_count = len(re.findall(r'\w+\s+(?:VARCHAR|INTEGER|BIGINT|DECIMAL|TIMESTAMP|DATE|BOOLEAN|TEXT|SERIAL)', schema_content, re.IGNORECASE))
        index_count = len(re.findall(r'CREATE INDEX', schema_content, re.IGNORECASE))
        
        # Count constraints
        primary_keys = len(re.findall(r'PRIMARY KEY', schema_content, re.IGNORECASE))
        foreign_keys = len(re.findall(r'FOREIGN KEY', schema_content, re.IGNORECASE))
        unique_constraints = len(re.findall(r'UNIQUE', schema_content, re.IGNORECASE))
        check_constraints = len(re.findall(r'CHECK\s*\(', schema_content, re.IGNORECASE))
        not_null = len(re.findall(r'NOT NULL', schema_content, re.IGNORECASE))
        
        total_constraints = primary_keys + foreign_keys + unique_constraints + check_constraints + not_null
        
        return {
            'tables': table_count,
            'columns': column_count,
            'constraints': total_constraints,
            'indexes': index_count,
            'has_foreign_keys': foreign_keys > 0,
            'has_unique': unique_constraints > 0,
            'has_check': check_constraints > 0
        }
    
    def categorize_schema(self, requirements: str) -> str:
        """Categorize schema based on requirements"""
        requirements_lower = requirements.lower()
        
        categories = {
            'e-commerce': ['product', 'order', 'cart', 'customer', 'payment', 'inventory', 'shipping'],
            'blog': ['post', 'comment', 'author', 'tag', 'category', 'article'],
            'financial': ['account', 'transaction', 'balance', 'payment', 'invoice', 'audit'],
            'user_management': ['user', 'auth', 'profile', 'permission', 'role'],
            'analytics': ['metric', 'event', 'tracking', 'report', 'dashboard'],
            'social': ['friend', 'message', 'follow', 'like', 'share', 'network'],
            'content': ['media', 'file', 'document', 'upload', 'attachment'],
            'hr': ['employee', 'department', 'salary', 'attendance', 'leave'],
            'education': ['student', 'course', 'grade', 'enrollment', 'teacher'],
            'healthcare': ['patient', 'doctor', 'appointment', 'medical', 'prescription']
        }
        
        for category, keywords in categories.items():
            if any(keyword in requirements_lower for keyword in keywords):
                return category
        
        return 'general'
    
    def calculate_quality_score(self, schema_content: str, explanation: str, optimizations: str) -> SchemaQualityScore:
        """Calculate comprehensive quality score for generated schema"""
        analysis = self.analyze_schema_content(schema_content)
        
        # Normalization score (based on relationships and structure)
        normalization_score = min(100, 
            (analysis['has_foreign_keys'] * 40) +
            (analysis['tables'] > 1) * 30 +
            (analysis['constraints'] > analysis['tables']) * 30
        )
        
        # Constraint coverage (based on data integrity features)
        constraint_coverage = min(100,
            (analysis['has_foreign_keys'] * 25) +
            (analysis['has_unique'] * 25) +
            (analysis['has_check'] * 25) +
            (analysis['constraints'] > 0) * 25
        )
        
        # Indexing quality (based on performance considerations)
        indexing_quality = min(100,
            (analysis['indexes'] > 0) * 50 +
            (analysis['indexes'] >= analysis['tables']) * 50
        )
        
        # Naming convention (basic heuristic)
        naming_score = 85  # Default good score, could be enhanced with ML
        
        # Documentation quality (based on explanation length and detail)
        doc_quality = min(100,
            (len(explanation) > 100) * 40 +
            (len(optimizations) > 50) * 30 +
            ('performance' in explanation.lower()) * 15 +
            ('scalability' in explanation.lower()) * 15
        )
        
        overall_score = (normalization_score + constraint_coverage + indexing_quality + naming_score + doc_quality) / 5
        
        return SchemaQualityScore(
            schema_id="",  # Will be set by caller
            normalization_score=normalization_score,
            constraint_coverage=constraint_coverage,
            indexing_quality=indexing_quality,
            naming_convention=naming_score,
            documentation_quality=doc_quality,
            overall_score=overall_score,
            timestamp=datetime.now()
        )
    
    def log_schema_generation(self, 
                            requirements: str,
                            schema_content: str,
                            explanation: str,
                            optimizations: str,
                            response_time: float,
                            docs_retrieved: int,
                            docs_used: int,
                            success: bool,
                            error_message: Optional[str] = None,
                            user_id: Optional[str] = None,
                            reranking_model: str = "cohere",
                            llm_model: str = "llama-3.3-70b",
                            dialect: str = "postgresql") -> str:
        """Log complete schema generation metrics"""
        
        # Generate unique schema ID
        schema_id = hashlib.md5(f"{requirements}{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        
        # Analyze schema content
        analysis = self.analyze_schema_content(schema_content)
        
        # Categorize schema
        category = self.categorize_schema(requirements)
        
        # Create metrics object
        metrics = SchemaMetrics(
            schema_id=schema_id,
            user_requirements=requirements,
            response_time=response_time,
            docs_retrieved=docs_retrieved,
            docs_used=docs_used,
            schema_complexity=analysis['tables'],
            total_columns=analysis['columns'],
            total_constraints=analysis['constraints'],
            total_indexes=analysis['indexes'],
            has_foreign_keys=analysis['has_foreign_keys'],
            has_unique_constraints=analysis['has_unique'],
            has_check_constraints=analysis['has_check'],
            schema_size_chars=len(schema_content),
            explanation_size_chars=len(explanation),
            optimization_size_chars=len(optimizations),
            reranking_model=reranking_model,
            llm_model=llm_model,
            success=success,
            error_message=error_message,
            timestamp=datetime.now(),
            user_id=user_id,
            schema_category=category
        )
        
        # Calculate quality score
        quality_score = self.calculate_quality_score(schema_content, explanation, optimizations)
        quality_score.schema_id = schema_id
        
        # Log to database
        with sqlite3.connect(self.db_path) as conn:
            # Insert metrics
            conn.execute("""
                INSERT OR REPLACE INTO schema_metrics 
                (schema_id, user_requirements, response_time, docs_retrieved, docs_used,
                 schema_complexity, total_columns, total_constraints, total_indexes,
                 has_foreign_keys, has_unique_constraints, has_check_constraints,
                 schema_size_chars, explanation_size_chars, optimization_size_chars,
                 reranking_model, llm_model, success, error_message, timestamp, user_id, schema_category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                metrics.schema_id, metrics.user_requirements, metrics.response_time,
                metrics.docs_retrieved, metrics.docs_used, metrics.schema_complexity,
                metrics.total_columns, metrics.total_constraints, metrics.total_indexes,
                metrics.has_foreign_keys, metrics.has_unique_constraints, metrics.has_check_constraints,
                metrics.schema_size_chars, metrics.explanation_size_chars, metrics.optimization_size_chars,
                metrics.reranking_model, metrics.llm_model, metrics.success,
                metrics.error_message, metrics.timestamp, metrics.user_id, metrics.schema_category
            ))
            
            # Insert quality score
            conn.execute("""
                INSERT INTO schema_quality 
                (schema_id, normalization_score, constraint_coverage, indexing_quality,
                 naming_convention, documentation_quality, overall_score, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                quality_score.schema_id, quality_score.normalization_score, quality_score.constraint_coverage,
                quality_score.indexing_quality, quality_score.naming_convention, quality_score.documentation_quality,
                quality_score.overall_score, quality_score.timestamp
            ))
        
        return schema_id
    
    def get_performance_stats(self, hours: int = 24, project_id: Optional[str] = None) -> Dict:
        """Get comprehensive performance statistics"""
        since = datetime.now() - timedelta(hours=hours)
        
        with sqlite3.connect(self.db_path) as conn:
            # Build query with optional project filter
            base_where = "WHERE timestamp >= ?"
            params = [since]
            
            if project_id:
                base_where += " AND user_id = ?"
                params.append(project_id)
            
            # Overall performance stats
            overall = conn.execute(f"""
                SELECT 
                    COUNT(*) as total_schemas,
                    AVG(response_time) as avg_response_time,
                    AVG(schema_complexity) as avg_complexity,
                    AVG(total_columns) as avg_columns,
                    AVG(total_constraints) as avg_constraints,
                    AVG(total_indexes) as avg_indexes,
                    SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
                    SUM(CASE WHEN has_foreign_keys THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as fk_usage_rate
                FROM schema_metrics 
                {base_where}
            """, tuple(params)).fetchone()
            
            # Quality statistics
            quality_stats = conn.execute(f"""
                SELECT 
                    AVG(sq.overall_score) as avg_quality_score,
                    AVG(sq.normalization_score) as avg_normalization,
                    AVG(sq.constraint_coverage) as avg_constraint_coverage,
                    AVG(sq.indexing_quality) as avg_indexing_quality
                FROM schema_quality sq
                JOIN schema_metrics sm ON sq.schema_id = sm.schema_id
                {base_where.replace('timestamp', 'sm.timestamp')}
            """, tuple(params)).fetchone()
            
            # By category
            by_category = conn.execute(f"""
                SELECT 
                    schema_category,
                    COUNT(*) as count,
                    AVG(response_time) as avg_response_time,
                    AVG(schema_complexity) as avg_complexity
                FROM schema_metrics 
                {base_where} AND success = 1
                GROUP BY schema_category
                ORDER BY count DESC
            """, tuple(params)).fetchall()
            
            # Complexity distribution
            complexity_dist = conn.execute(f"""
                SELECT 
                    CASE 
                        WHEN schema_complexity = 1 THEN 'Simple (1 table)'
                        WHEN schema_complexity BETWEEN 2 AND 5 THEN 'Medium (2-5 tables)'
                        WHEN schema_complexity BETWEEN 6 AND 10 THEN 'Complex (6-10 tables)'
                        ELSE 'Very Complex (10+ tables)'
                    END as complexity_level,
                    COUNT(*) as count,
                    AVG(response_time) as avg_response_time
                FROM schema_metrics 
                {base_where} AND success = 1
                GROUP BY complexity_level
            """, tuple(params)).fetchall()
        
        return {
            'period_hours': hours,
            'overall': dict(zip([
                'total_schemas', 'avg_response_time', 'avg_complexity', 'avg_columns',
                'avg_constraints', 'avg_indexes', 'success_rate', 'fk_usage_rate'
            ], overall)) if overall else {},
            'quality': dict(zip([
                'avg_quality_score', 'avg_normalization', 'avg_constraint_coverage', 'avg_indexing_quality'
            ], quality_stats)) if quality_stats else {},
            'by_category': [dict(zip(['category', 'count', 'avg_response_time', 'avg_complexity'], row)) for row in by_category],
            'complexity_distribution': [dict(zip(['level', 'count', 'avg_response_time'], row)) for row in complexity_dist]
        }
    
    def get_slow_generations(self, threshold: float = 10.0, limit: int = 10) -> List[Dict]:
        """Get slowest schema generations above threshold"""
        with sqlite3.connect(self.db_path) as conn:
            slow_schemas = conn.execute("""
                SELECT user_requirements, response_time, schema_complexity, total_columns, timestamp
                FROM schema_metrics 
                WHERE response_time > ? AND success = 1
                ORDER BY response_time DESC
                LIMIT ?
            """, (threshold, limit)).fetchall()
        
        return [dict(zip(['requirements', 'response_time', 'complexity', 'columns', 'timestamp'], row)) for row in slow_schemas]
    
    def get_top_quality_schemas(self, limit: int = 10) -> List[Dict]:
        """Get highest quality schema generations"""
        with sqlite3.connect(self.db_path) as conn:
            top_schemas = conn.execute("""
                SELECT sm.user_requirements, sm.schema_complexity, sq.overall_score, sm.timestamp
                FROM schema_metrics sm
                JOIN schema_quality sq ON sm.schema_id = sq.schema_id
                WHERE sm.success = 1
                ORDER BY sq.overall_score DESC
                LIMIT ?
            """, (limit,)).fetchall()
        
        return [dict(zip(['requirements', 'complexity', 'quality_score', 'timestamp'], row)) for row in top_schemas]
    
    def export_analytics(self, hours: int = 24) -> str:
        """Export comprehensive analytics as JSON"""
        stats = self.get_performance_stats(hours)
        slow_generations = self.get_slow_generations()
        top_quality = self.get_top_quality_schemas()
        
        return json.dumps({
            'generated_at': datetime.now().isoformat(),
            'performance_stats': stats,
            'slow_generations': slow_generations,
            'top_quality_schemas': top_quality
        }, indent=2)
    
    def get_usage_trends(self, days: int = 7) -> Dict:
        """Get usage trends over time"""
        with sqlite3.connect(self.db_path) as conn:
            daily_usage = conn.execute("""
                SELECT 
                    DATE(sm.timestamp) as date,
                    COUNT(*) as schemas_generated,
                    AVG(sm.response_time) as avg_response_time,
                    AVG(sq.overall_score) as avg_quality
                FROM schema_metrics sm
                LEFT JOIN schema_quality sq ON sm.schema_id = sq.schema_id
                WHERE sm.timestamp >= datetime('now', '-{} days')
                GROUP BY DATE(sm.timestamp)
                ORDER BY date DESC
            """.format(days)).fetchall()
        
        return {
            'daily_trends': [dict(zip(['date', 'schemas_generated', 'avg_response_time', 'avg_quality'], row)) for row in daily_usage]
        }
    
    def log_rag_metrics(self, schema_id: str, retrieval_metrics: Dict, rerank_metrics: Dict):
        """Log RAG pipeline performance metrics"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO rag_analytics 
                (schema_id, retrieval_time, docs_retrieved, avg_retrieval_score,
                 rerank_time, rerank_model, docs_after_rerank, avg_rerank_score,
                 score_improvement, top_doc_sources, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                schema_id,
                retrieval_metrics.get('retrieval_time', 0),
                retrieval_metrics.get('docs_retrieved', 0),
                retrieval_metrics.get('avg_score', 0),
                rerank_metrics.get('rerank_time', 0),
                rerank_metrics.get('model', 'cohere'),
                rerank_metrics.get('docs_after', 0),
                rerank_metrics.get('avg_score', 0),
                rerank_metrics.get('score_improvement', 0),
                ','.join(rerank_metrics.get('top_sources', [])),
                datetime.now()
            ))
    
    def get_rag_performance_stats(self, hours: int = 24) -> Dict:
        """Get RAG pipeline performance statistics"""
        since = datetime.now() - timedelta(hours=hours)
        
        with sqlite3.connect(self.db_path) as conn:
            stats = conn.execute("""
                SELECT 
                    COUNT(*) as total_queries,
                    AVG(retrieval_time) as avg_retrieval_time,
                    AVG(docs_retrieved) as avg_docs_retrieved,
                    AVG(avg_retrieval_score) as avg_retrieval_score,
                    AVG(rerank_time) as avg_rerank_time,
                    AVG(docs_after_rerank) as avg_docs_after_rerank,
                    AVG(avg_rerank_score) as avg_rerank_score,
                    AVG(score_improvement) as avg_score_improvement
                FROM rag_analytics
                WHERE timestamp >= ?
            """, (since,)).fetchone()
            
            # Top document sources
            top_sources = conn.execute("""
                SELECT top_doc_sources, COUNT(*) as usage_count
                FROM rag_analytics
                WHERE timestamp >= ?
                GROUP BY top_doc_sources
                ORDER BY usage_count DESC
                LIMIT 10
            """, (since,)).fetchall()
        
        return {
            'overall': dict(zip([
                'total_queries', 'avg_retrieval_time', 'avg_docs_retrieved',
                'avg_retrieval_score', 'avg_rerank_time', 'avg_docs_after_rerank',
                'avg_rerank_score', 'avg_score_improvement'
            ], stats)) if stats else {},
            'top_sources': [{'source': row[0], 'count': row[1]} for row in top_sources]
        }

# Global analytics instance
schema_analytics = SchemaAnalytics()