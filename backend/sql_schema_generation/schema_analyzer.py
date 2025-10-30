"""
Schema Analyzer
Analyzes existing database schemas and provides optimization recommendations
"""

from typing import Dict, List, Any, Optional
import sqlite3
import re
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@dataclass
class TableAnalysis:
    """Analysis result for a database table"""
    table_name: str
    column_count: int
    estimated_rows: int
    primary_key: Optional[str]
    foreign_keys: List[str]
    indexes: List[str]
    issues: List[str]
    recommendations: List[str]

@dataclass
class SchemaAnalysisResult:
    """Complete schema analysis result"""
    total_tables: int
    total_columns: int
    relationships: int
    issues_found: int
    performance_score: float
    table_analyses: List[TableAnalysis]
    global_recommendations: List[str]
    optimization_opportunities: List[str]

class SchemaAnalyzer:
    """Analyzes database schemas and provides optimization recommendations"""
    
    def __init__(self):
        self.analysis_patterns = {
            'naming_convention': r'^[a-z][a-z0-9_]*$',
            'primary_key_pattern': r'.*_id$|^id$',
            'foreign_key_pattern': r'.*_id$',
            'index_pattern': r'^idx_|^ix_'
        }
    
    def analyze_ddl_statements(self, ddl_statements: str) -> SchemaAnalysisResult:
        """Analyze DDL statements and provide recommendations"""
        try:
            # Parse DDL statements
            tables = self.parse_ddl_statements(ddl_statements)
            
            # Analyze each table
            table_analyses = []
            total_columns = 0
            total_issues = 0
            
            for table in tables:
                analysis = self.analyze_table(table)
                table_analyses.append(analysis)
                total_columns += analysis.column_count
                total_issues += len(analysis.issues)
            
            # Calculate performance score
            performance_score = self.calculate_performance_score(table_analyses)
            
            # Generate global recommendations
            global_recommendations = self.generate_global_recommendations(table_analyses)
            optimization_opportunities = self.find_optimization_opportunities(table_analyses)
            
            return SchemaAnalysisResult(
                total_tables=len(tables),
                total_columns=total_columns,
                relationships=self.count_relationships(table_analyses),
                issues_found=total_issues,
                performance_score=performance_score,
                table_analyses=table_analyses,
                global_recommendations=global_recommendations,
                optimization_opportunities=optimization_opportunities
            )
            
        except Exception as e:
            logger.error(f"Error analyzing schema: {str(e)}")
            raise
    
    def parse_ddl_statements(self, ddl: str) -> List[Dict[str, Any]]:
        """Parse DDL statements to extract table information"""
        tables = []
        
        # Split by CREATE TABLE statements
        create_table_pattern = r'CREATE\s+TABLE\s+(\w+)\s*\((.*?)\)(?:;|\s*$)'
        matches = re.finditer(create_table_pattern, ddl, re.IGNORECASE | re.DOTALL)
        
        for match in matches:
            table_name = match.group(1).strip()
            columns_str = match.group(2).strip()
            
            # Parse columns
            columns = self.parse_columns(columns_str)
            
            # Extract constraints
            primary_key = self.extract_primary_key(columns_str)
            foreign_keys = self.extract_foreign_keys(columns_str)
            
            tables.append({
                'name': table_name,
                'columns': columns,
                'primary_key': primary_key,
                'foreign_keys': foreign_keys
            })
        
        return tables
    
    def parse_columns(self, columns_str: str) -> List[Dict[str, str]]:
        """Parse column definitions"""
        columns = []
        
        # Split by commas but handle nested parentheses
        column_lines = self.split_columns(columns_str)
        
        for line in column_lines:
            line = line.strip()
            if not line or line.upper().startswith(('PRIMARY KEY', 'FOREIGN KEY', 'CONSTRAINT')):
                continue
            
            # Extract column name and type
            parts = line.split()
            if len(parts) >= 2:
                column_name = parts[0].strip()
                column_type = parts[1].strip()
                
                columns.append({
                    'name': column_name,
                    'type': column_type,
                    'definition': line
                })
        
        return columns
    
    def split_columns(self, columns_str: str) -> List[str]:
        """Split column definitions by commas, handling nested parentheses"""
        result = []
        current = ""
        paren_depth = 0
        
        for char in columns_str:
            if char == '(':
                paren_depth += 1
            elif char == ')':
                paren_depth -= 1
            elif char == ',' and paren_depth == 0:
                result.append(current.strip())
                current = ""
                continue
            
            current += char
        
        if current.strip():
            result.append(current.strip())
        
        return result
    
    def extract_primary_key(self, columns_str: str) -> Optional[str]:
        """Extract primary key from column definitions"""
        pk_pattern = r'PRIMARY\s+KEY\s*\(\s*(\w+)\s*\)'
        match = re.search(pk_pattern, columns_str, re.IGNORECASE)
        
        if match:
            return match.group(1)
        
        # Check for inline PRIMARY KEY
        inline_pk_pattern = r'(\w+)\s+\w+.*PRIMARY\s+KEY'
        match = re.search(inline_pk_pattern, columns_str, re.IGNORECASE)
        
        if match:
            return match.group(1)
        
        return None
    
    def extract_foreign_keys(self, columns_str: str) -> List[str]:
        """Extract foreign keys from column definitions"""
        foreign_keys = []
        
        fk_pattern = r'FOREIGN\s+KEY\s*\(\s*(\w+)\s*\)\s+REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)'
        matches = re.finditer(fk_pattern, columns_str, re.IGNORECASE)
        
        for match in matches:
            fk_column = match.group(1)
            ref_table = match.group(2)
            ref_column = match.group(3)
            foreign_keys.append(f"{fk_column} -> {ref_table}.{ref_column}")
        
        return foreign_keys
    
    def analyze_table(self, table: Dict[str, Any]) -> TableAnalysis:
        """Analyze a single table"""
        issues = []
        recommendations = []
        
        table_name = table['name']
        columns = table['columns']
        primary_key = table['primary_key']
        foreign_keys = table['foreign_keys']
        
        # Check naming conventions
        if not re.match(self.analysis_patterns['naming_convention'], table_name):
            issues.append(f"Table name '{table_name}' doesn't follow snake_case convention")
        
        # Check for primary key
        if not primary_key:
            issues.append("No primary key defined")
            recommendations.append("Add a primary key for better performance and data integrity")
        
        # Analyze columns
        for column in columns:
            column_name = column['name']
            column_type = column['type']
            
            # Check column naming
            if not re.match(self.analysis_patterns['naming_convention'], column_name):
                issues.append(f"Column '{column_name}' doesn't follow naming convention")
            
            # Check for VARCHAR without length
            if 'VARCHAR' in column_type.upper() and '(' not in column_type:
                issues.append(f"VARCHAR column '{column_name}' should specify length")
                recommendations.append(f"Specify appropriate length for VARCHAR column '{column_name}'")
        
        # Performance recommendations
        if len(columns) > 20:
            recommendations.append("Consider normalizing - table has many columns")
        
        if foreign_keys:
            recommendations.append("Consider adding indexes on foreign key columns for better JOIN performance")
        
        return TableAnalysis(
            table_name=table_name,
            column_count=len(columns),
            estimated_rows=1000,  # Default estimation
            primary_key=primary_key,
            foreign_keys=foreign_keys,
            indexes=[],  # Would need additional parsing for CREATE INDEX statements
            issues=issues,
            recommendations=recommendations
        )
    
    def calculate_performance_score(self, table_analyses: List[TableAnalysis]) -> float:
        """Calculate overall performance score (0-100)"""
        if not table_analyses:
            return 0.0
        
        total_score = 0
        max_score = 0
        
        for analysis in table_analyses:
            # Scoring criteria
            table_score = 100
            table_max = 100
            
            # Deduct points for issues
            table_score -= len(analysis.issues) * 10
            
            # Bonus for having primary key
            if analysis.primary_key:
                table_score += 10
                table_max += 10
            
            # Ensure score doesn't go below 0
            table_score = max(0, table_score)
            
            total_score += table_score
            max_score += table_max
        
        return (total_score / max_score) * 100 if max_score > 0 else 0.0
    
    def count_relationships(self, table_analyses: List[TableAnalysis]) -> int:
        """Count total relationships in the schema"""
        total_relationships = 0
        for analysis in table_analyses:
            total_relationships += len(analysis.foreign_keys)
        return total_relationships
    
    def generate_global_recommendations(self, table_analyses: List[TableAnalysis]) -> List[str]:
        """Generate schema-wide recommendations"""
        recommendations = []
        
        # Check for tables without relationships
        isolated_tables = [a.table_name for a in table_analyses if not a.foreign_keys]
        if len(isolated_tables) > len(table_analyses) * 0.5:
            recommendations.append("Many tables lack relationships - consider if normalization is needed")
        
        # Check for naming consistency
        table_names = [a.table_name for a in table_analyses]
        if any('_' not in name for name in table_names) and any('_' in name for name in table_names):
            recommendations.append("Inconsistent table naming convention - standardize on snake_case")
        
        # Performance recommendations
        total_columns = sum(a.column_count for a in table_analyses)
        avg_columns = total_columns / len(table_analyses)
        
        if avg_columns > 15:
            recommendations.append("High average column count - consider table normalization")
        
        return recommendations
    
    def find_optimization_opportunities(self, table_analyses: List[TableAnalysis]) -> List[str]:
        """Find specific optimization opportunities"""
        opportunities = []
        
        # Find tables that could benefit from indexing
        for analysis in table_analyses:
            if analysis.foreign_keys and not analysis.indexes:
                opportunities.append(f"Add indexes on foreign keys in '{analysis.table_name}' table")
        
        # Find potential denormalization opportunities
        small_tables = [a for a in table_analyses if a.column_count <= 3]
        if len(small_tables) > 3:
            opportunities.append("Consider denormalizing small lookup tables for better performance")
        
        return opportunities

def main():
    """Test the schema analyzer"""
    analyzer = SchemaAnalyzer()
    
    # Test DDL
    test_ddl = """
    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        title VARCHAR(200),
        content TEXT,
        created_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    """
    
    print("🔍 Testing Schema Analyzer...")
    result = analyzer.analyze_ddl_statements(test_ddl)
    
    print(f"\n📊 Analysis Results:")
    print(f"Tables: {result.total_tables}")
    print(f"Columns: {result.total_columns}")
    print(f"Relationships: {result.relationships}")
    print(f"Issues Found: {result.issues_found}")
    print(f"Performance Score: {result.performance_score:.1f}/100")
    
    print(f"\n🗂️ Table Details:")
    for analysis in result.table_analyses:
        print(f"  {analysis.table_name}: {analysis.column_count} columns, PK: {analysis.primary_key}")
        if analysis.issues:
            print(f"    Issues: {', '.join(analysis.issues)}")
    
    if result.global_recommendations:
        print(f"\n💡 Global Recommendations:")
        for rec in result.global_recommendations:
            print(f"  • {rec}")

if __name__ == "__main__":
    main()