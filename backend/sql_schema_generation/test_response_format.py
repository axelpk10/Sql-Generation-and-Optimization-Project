"""
Response Format Tester
Tests and displays the exact output format from the schema generation module
"""

import json
import time
from datetime import datetime
from schema_generator import SchemaGenerator
from pathlib import Path

class ResponseFormatTester:
    """Test and analyze the response format from schema generation"""
    
    def __init__(self):
        self.generator = SchemaGenerator()
        self.test_results = []
    
    def test_response_format(self, requirements, test_name):
        """Test a specific requirement and analyze the response format"""
        print(f"\n{'='*60}")
        print(f"🧪 TEST: {test_name}")
        print(f"{'='*60}")
        print(f"📝 Requirements: {requirements}")
        print(f"\n⏳ Generating schema...")
        
        start_time = time.time()
        result = self.generator.generate_schema(requirements)
        end_time = time.time()
        
        if not result.get('success'):
            print(f"❌ Generation failed: {result.get('error')}")
            return
        
        # Extract components
        schema = result.get('schema', '')
        explanation = result.get('explanation', '')
        optimizations = result.get('optimizations', '')
        response_time = result.get('response_time', 0)
        
        print(f"✅ Generation completed in {response_time:.2f}s")
        print(f"📊 Total response length: {len(schema) + len(explanation) + len(optimizations)} characters")
        
        # Analyze schema format
        print(f"\n🗄️ SCHEMA SECTION ({len(schema)} characters):")
        print(f"{'─'*50}")
        self.analyze_schema_format(schema)
        
        # Show actual schema output
        print(f"\n📋 ACTUAL SCHEMA OUTPUT:")
        print(f"{'─'*50}")
        print(schema[:1000] + "..." if len(schema) > 1000 else schema)
        
        if explanation:
            print(f"\n📝 EXPLANATION SECTION ({len(explanation)} characters):")
            print(f"{'─'*50}")
            print(explanation[:500] + "..." if len(explanation) > 500 else explanation)
        
        if optimizations:
            print(f"\n⚡ OPTIMIZATIONS SECTION ({len(optimizations)} characters):")
            print(f"{'─'*50}")
            print(optimizations[:500] + "..." if len(optimizations) > 500 else optimizations)
        
        # Store result for summary
        self.test_results.append({
            'test_name': test_name,
            'requirements': requirements,
            'schema_length': len(schema),
            'explanation_length': len(explanation),
            'optimizations_length': len(optimizations),
            'response_time': response_time,
            'has_create_table': 'CREATE TABLE' in schema.upper(),
            'has_primary_key': 'PRIMARY KEY' in schema.upper(),
            'has_foreign_key': 'FOREIGN KEY' in schema.upper(),
            'has_constraints': any(keyword in schema.upper() for keyword in ['CONSTRAINT', 'NOT NULL', 'UNIQUE']),
            'table_count': schema.upper().count('CREATE TABLE'),
            'timestamp': datetime.now().isoformat()
        })
    
    def analyze_schema_format(self, schema):
        """Analyze the format and structure of the generated schema"""
        if not schema:
            print("❌ No schema generated")
            return
        
        # Check for SQL keywords
        sql_keywords = {
            'CREATE TABLE': schema.upper().count('CREATE TABLE'),
            'PRIMARY KEY': schema.upper().count('PRIMARY KEY'),
            'FOREIGN KEY': schema.upper().count('FOREIGN KEY'),
            'NOT NULL': schema.upper().count('NOT NULL'),
            'UNIQUE': schema.upper().count('UNIQUE'),
            'INDEX': schema.upper().count('INDEX'),
            'CONSTRAINT': schema.upper().count('CONSTRAINT'),
            'VARCHAR': schema.upper().count('VARCHAR'),
            'INTEGER': schema.upper().count('INTEGER'),
            'TEXT': schema.upper().count('TEXT'),
            'DATETIME': schema.upper().count('DATETIME'),
            'BOOLEAN': schema.upper().count('BOOLEAN')
        }
        
        print("🔍 SQL KEYWORD ANALYSIS:")
        for keyword, count in sql_keywords.items():
            if count > 0:
                print(f"   ✅ {keyword}: {count} occurrences")
            else:
                print(f"   ❌ {keyword}: Not found")
        
        # Check format quality
        print(f"\n📊 FORMAT QUALITY ANALYSIS:")
        
        # Check if it's proper SQL
        has_create_statements = sql_keywords['CREATE TABLE'] > 0
        has_proper_syntax = '(' in schema and ')' in schema and ';' in schema
        has_data_types = any(schema.upper().count(dt) > 0 for dt in ['VARCHAR', 'INTEGER', 'TEXT', 'DATETIME'])
        
        print(f"   {'✅' if has_create_statements else '❌'} Contains CREATE TABLE statements: {has_create_statements}")
        print(f"   {'✅' if has_proper_syntax else '❌'} Has proper SQL syntax (parentheses, semicolons): {has_proper_syntax}")
        print(f"   {'✅' if has_data_types else '❌'} Contains data type specifications: {has_data_types}")
        
        # Estimate if it's executable SQL
        is_executable = has_create_statements and has_proper_syntax and has_data_types
        print(f"   {'✅' if is_executable else '❌'} Appears to be executable SQL: {is_executable}")
        
        # Line analysis
        lines = schema.split('\n')
        non_empty_lines = [line.strip() for line in lines if line.strip()]
        
        print(f"\n📏 STRUCTURE ANALYSIS:")
        print(f"   Total lines: {len(lines)}")
        print(f"   Non-empty lines: {len(non_empty_lines)}")
        print(f"   Average line length: {sum(len(line) for line in non_empty_lines) / len(non_empty_lines):.1f} characters" if non_empty_lines else "N/A")
    
    def run_comprehensive_format_test(self):
        """Run comprehensive tests with different types of requirements"""
        print("🚀 SCHEMA GENERATION RESPONSE FORMAT TESTER")
        print(f"{'='*80}")
        print(f"🕒 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Test cases with varying complexity
        test_cases = [
            {
                'name': 'Simple User Table',
                'requirements': 'Create a simple user table with id, username, email, and password fields.'
            },
            {
                'name': 'Blog System',
                'requirements': '''Design a blog database with:
                - Users (authentication and profiles)
                - Blog posts with categories
                - Comments and replies
                - Tags system'''
            },
            {
                'name': 'E-commerce Platform',
                'requirements': '''Create a comprehensive e-commerce database including:
                - Customer management (users, addresses, payment methods)
                - Product catalog (categories, inventory, pricing)
                - Order processing (cart, orders, payments)
                - Reviews and ratings
                - Admin and analytics tables
                
                Requirements:
                - High performance for read-heavy workloads
                - Proper indexing for search functionality
                - Audit trails for financial transactions'''
            },
            {
                'name': 'Financial System',
                'requirements': '''Design a financial management system with:
                - Account management
                - Transaction processing
                - Balance tracking
                - Audit and compliance features
                - Multi-currency support
                
                Must be ACID compliant with proper constraints.'''
            }
        ]
        
        # Run all test cases
        for test_case in test_cases:
            self.test_response_format(test_case['requirements'], test_case['name'])
        
        # Generate summary
        self.generate_summary_report()
    
    def generate_summary_report(self):
        """Generate a summary report of all test results"""
        print(f"\n{'='*80}")
        print(f"📊 COMPREHENSIVE SUMMARY REPORT")
        print(f"{'='*80}")
        
        if not self.test_results:
            print("❌ No test results to summarize")
            return
        
        total_tests = len(self.test_results)
        successful_tests = sum(1 for r in self.test_results if r['schema_length'] > 0)
        
        print(f"📈 Overall Statistics:")
        print(f"   Total tests run: {total_tests}")
        print(f"   Successful generations: {successful_tests}")
        print(f"   Success rate: {(successful_tests/total_tests)*100:.1f}%")
        
        # Schema quality analysis
        sql_compliant = sum(1 for r in self.test_results if r['has_create_table'])
        has_constraints = sum(1 for r in self.test_results if r['has_constraints'])
        has_relationships = sum(1 for r in self.test_results if r['has_foreign_key'])
        
        print(f"\n🏗️ Schema Quality:")
        print(f"   SQL compliant (has CREATE TABLE): {sql_compliant}/{total_tests} ({(sql_compliant/total_tests)*100:.1f}%)")
        print(f"   Has constraints: {has_constraints}/{total_tests} ({(has_constraints/total_tests)*100:.1f}%)")
        print(f"   Has relationships: {has_relationships}/{total_tests} ({(has_relationships/total_tests)*100:.1f}%)")
        
        # Performance analysis
        avg_response_time = sum(r['response_time'] for r in self.test_results) / total_tests
        avg_schema_length = sum(r['schema_length'] for r in self.test_results) / total_tests
        total_tables = sum(r['table_count'] for r in self.test_results)
        
        print(f"\n⚡ Performance Metrics:")
        print(f"   Average response time: {avg_response_time:.2f} seconds")
        print(f"   Average schema length: {avg_schema_length:.0f} characters")
        print(f"   Total tables generated: {total_tables}")
        print(f"   Average tables per schema: {total_tables/total_tests:.1f}")
        
        # Detailed breakdown
        print(f"\n📋 Detailed Test Results:")
        print(f"{'Test Name':<20} {'Tables':<8} {'Schema Len':<12} {'Time (s)':<10} {'SQL Valid':<10}")
        print(f"{'-'*70}")
        
        for result in self.test_results:
            sql_valid = "✅" if result['has_create_table'] else "❌"
            print(f"{result['test_name']:<20} {result['table_count']:<8} {result['schema_length']:<12} {result['response_time']:<10.2f} {sql_valid:<10}")
        
        # Save detailed results
        self.save_detailed_results()
        
        print(f"\n✅ Format testing completed successfully!")
        print(f"💡 Conclusion: The module generates {'✅ PROPER SQL CODE' if sql_compliant == total_tests else '❌ MIXED FORMAT'}")
    
    def save_detailed_results(self):
        """Save detailed test results to JSON file"""
        try:
            results_file = Path(__file__).parent / "response_format_test_results.json"
            
            report = {
                'test_metadata': {
                    'timestamp': datetime.now().isoformat(),
                    'total_tests': len(self.test_results),
                    'successful_tests': sum(1 for r in self.test_results if r['schema_length'] > 0)
                },
                'test_results': self.test_results,
                'summary_statistics': {
                    'avg_response_time': sum(r['response_time'] for r in self.test_results) / len(self.test_results),
                    'avg_schema_length': sum(r['schema_length'] for r in self.test_results) / len(self.test_results),
                    'total_tables_generated': sum(r['table_count'] for r in self.test_results),
                    'sql_compliance_rate': sum(1 for r in self.test_results if r['has_create_table']) / len(self.test_results)
                }
            }
            
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            print(f"📁 Detailed results saved to: {results_file}")
            
        except Exception as e:
            print(f"⚠️ Could not save detailed results: {str(e)}")

def main():
    """Run the response format testing"""
    print("🔍 STARTING RESPONSE FORMAT ANALYSIS")
    print("This will test what type of output the schema generation module produces\n")
    
    tester = ResponseFormatTester()
    tester.run_comprehensive_format_test()

if __name__ == "__main__":
    main()