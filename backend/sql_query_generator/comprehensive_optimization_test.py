"""
Comprehensive Query Optimization and Generation Test
Tests the SQL Query Generator with complex optimization scenarios
Displays full model output including queries, explanations, and optimizations
"""

import sys
import os
import time
import json
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

# Import the query processing function
try:
    from faiss_main import process_query
    print("✅ Successfully imported query processing module")
except ImportError as e:
    print(f"❌ Error importing query processing module: {e}")
    sys.exit(1)

class ComprehensiveQueryTester:
    """Comprehensive tester for SQL query optimization and generation"""
    
    def __init__(self):
        self.test_queries = [
            {
                "id": 1,
                "category": "Complex Join Optimization",
                "query": "I need to join customer data from MySQL with order history from Hive and product information from PostgreSQL. The query is running slow with millions of records. How can I optimize this cross-connector query in Trino?",
                "focus": "Cross-connector optimization, join strategies, performance tuning"
            },
            {
                "id": 2,
                "category": "Window Function Performance",
                "query": "Create a query that calculates running totals, rank products by sales within each category, and shows percentage contribution to total sales. Need this to run efficiently on large datasets with proper partitioning.",
                "focus": "Window functions, partitioning, analytical queries"
            },
            {
                "id": 3,
                "category": "Array and JSON Processing",
                "query": "I have a table with JSON columns containing nested arrays of product attributes. Need to flatten this data, extract specific fields, and aggregate by product categories. What's the most efficient way in Trino?",
                "focus": "JSON processing, array operations, data transformation"
            },
            {
                "id": 4,
                "category": "Partition Pruning Optimization",
                "query": "My fact table is partitioned by date and region, but queries are still scanning all partitions. Need help with predicate pushdown and partition elimination for time-series analysis with date ranges.",
                "focus": "Partition pruning, predicate pushdown, time-series optimization"
            },
            {
                "id": 5,
                "category": "Resource Management & Scaling",
                "query": "Large aggregation queries are consuming too much memory and causing OOM errors. Need to optimize resource usage, implement proper bucketing, and handle large GROUP BY operations efficiently.",
                "focus": "Memory optimization, resource management, bucketing strategies"
            }
        ]
        
        self.results = []
    
    def run_single_test(self, test_case):
        """Run a single test case and capture full output"""
        print(f"\n{'='*80}")
        print(f"🧪 TEST {test_case['id']}: {test_case['category']}")
        print(f"{'='*80}")
        print(f"📝 Query: {test_case['query']}")
        print(f"🎯 Focus Areas: {test_case['focus']}")
        print(f"{'='*80}")
        
        start_time = time.time()
        
        try:
            # Process the query using the main query processing function
            result = process_query(test_case['query'])
            
            end_time = time.time()
            response_time = end_time - start_time
            
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
                return {
                    'test_id': test_case['id'],
                    'category': test_case['category'],
                    'success': False,
                    'error': result['error'],
                    'response_time': response_time
                }
            
            # Display comprehensive results
            print(f"\n⏱️  Response Time: {response_time:.2f} seconds")
            print(f"📊 Retrieved Documents: {result.get('retrieved_docs_count', 'N/A')}")
            
            print(f"\n🎯 TRINO BEST PRACTICES:")
            print("=" * 50)
            best_practices = result.get('best_practices', 'No best practices available')
            print(best_practices)
            
            print(f"\n📚 DOCUMENTATION CONTEXT:")
            print("=" * 50)
            doc_context = result.get('documentation_context', 'No documentation context available')
            # Truncate for readability but show structure
            if len(doc_context) > 1000:
                print(f"{doc_context[:1000]}...")
                print(f"[... truncated, total length: {len(doc_context)} characters]")
            else:
                print(doc_context)
            
            print(f"\n🔧 GENERATED TRINO QUERY:")
            print("=" * 50)
            generated_query = result.get('generated_query', 'No query generated')
            print(generated_query)
            
            # Parse and display structured output if available
            self.parse_and_display_query_sections(generated_query)
            
            # Store results for analysis
            test_result = {
                'test_id': test_case['id'],
                'category': test_case['category'],
                'query': test_case['query'],
                'focus': test_case['focus'],
                'success': True,
                'response_time': response_time,
                'retrieved_docs': result.get('retrieved_docs_count', 0),
                'best_practices': best_practices,
                'generated_query': generated_query,
                'doc_context_length': len(doc_context)
            }
            
            self.results.append(test_result)
            
            print(f"\n✅ Test {test_case['id']} completed successfully")
            return test_result
            
        except Exception as e:
            end_time = time.time()
            response_time = end_time - start_time
            
            print(f"❌ Exception occurred: {str(e)}")
            return {
                'test_id': test_case['id'],
                'category': test_case['category'],
                'success': False,
                'error': str(e),
                'response_time': response_time
            }
    
    def parse_and_display_query_sections(self, generated_query):
        """Parse and display structured sections from the generated query"""
        if not generated_query:
            return
        
        # Look for structured sections in the response
        sections = {
            'QUERY:': '💾 SQL QUERY',
            'EXPLANATION:': '📖 EXPLANATION', 
            'OPTIMIZATIONS:': '⚡ OPTIMIZATIONS'
        }
        
        current_section = None
        section_content = {}
        
        lines = generated_query.split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Check if this line starts a new section
            section_found = False
            for section_key, section_title in sections.items():
                if line.upper().startswith(section_key):
                    if current_section:
                        # Save previous section
                        section_content[current_section] = '\n'.join(section_content.get(current_section, []))
                    current_section = section_title
                    section_content[current_section] = []
                    section_found = True
                    break
            
            if not section_found and current_section and line:
                section_content[current_section].append(line)
        
        # Save the last section
        if current_section:
            section_content[current_section] = '\n'.join(section_content.get(current_section, []))
        
        # Display parsed sections
        if section_content:
            print(f"\n📋 PARSED RESPONSE SECTIONS:")
            print("=" * 50)
            
            for section_title, content in section_content.items():
                print(f"\n{section_title}:")
                print("-" * 30)
                print(content.strip())
    
    def run_all_tests(self):
        """Run all test cases"""
        print("🚀 Starting Comprehensive Query Optimization Test Suite")
        print(f"📊 Total Test Cases: {len(self.test_queries)}")
        
        start_time = time.time()
        
        for test_case in self.test_queries:
            try:
                self.run_single_test(test_case)
                # Add delay between tests to avoid rate limiting
                time.sleep(1)
            except KeyboardInterrupt:
                print("\n⚠️  Test interrupted by user")
                break
            except Exception as e:
                print(f"❌ Unexpected error in test {test_case['id']}: {e}")
                continue
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Display summary
        self.display_test_summary(total_time)
    
    def display_test_summary(self, total_time):
        """Display comprehensive test summary"""
        print(f"\n{'='*80}")
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print(f"{'='*80}")
        
        successful_tests = [r for r in self.results if r.get('success', False)]
        failed_tests = [r for r in self.results if not r.get('success', False)]
        
        print(f"✅ Successful Tests: {len(successful_tests)}/{len(self.results)}")
        print(f"❌ Failed Tests: {len(failed_tests)}")
        print(f"⏱️  Total Execution Time: {total_time:.2f} seconds")
        
        if successful_tests:
            avg_response_time = sum(r['response_time'] for r in successful_tests) / len(successful_tests)
            max_response_time = max(r['response_time'] for r in successful_tests)
            min_response_time = min(r['response_time'] for r in successful_tests)
            
            print(f"\n📈 PERFORMANCE METRICS:")
            print(f"   Average Response Time: {avg_response_time:.2f}s")
            print(f"   Fastest Response: {min_response_time:.2f}s")
            print(f"   Slowest Response: {max_response_time:.2f}s")
            
            avg_docs = sum(r.get('retrieved_docs', 0) for r in successful_tests) / len(successful_tests)
            print(f"   Average Documents Retrieved: {avg_docs:.1f}")
        
        print(f"\n🏷️  TEST CATEGORIES COVERED:")
        for result in self.results:
            status = "✅" if result.get('success', False) else "❌"
            print(f"   {status} {result['category']} ({result['response_time']:.2f}s)")
        
        if failed_tests:
            print(f"\n❌ FAILED TESTS DETAILS:")
            for failed_test in failed_tests:
                print(f"   Test {failed_test['test_id']}: {failed_test.get('error', 'Unknown error')}")
        
        # Save results to file
        self.save_results_to_file()
    
    def save_results_to_file(self):
        """Save test results to JSON file"""
        try:
            results_file = Path(__file__).parent / "comprehensive_test_results.json"
            
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'test_timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'total_tests': len(self.results),
                    'successful_tests': len([r for r in self.results if r.get('success', False)]),
                    'results': self.results
                }, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Test results saved to: {results_file}")
            
        except Exception as e:
            print(f"⚠️  Could not save results to file: {e}")

def main():
    """Main function to run the comprehensive test"""
    print("🔧 Initializing Comprehensive Query Optimization Test Suite")
    
    tester = ComprehensiveQueryTester()
    
    try:
        tester.run_all_tests()
    except KeyboardInterrupt:
        print("\n⚠️  Test suite interrupted by user")
    except Exception as e:
        print(f"❌ Critical error in test suite: {e}")
    
    print(f"\n🎯 Test suite completed!")

if __name__ == "__main__":
    main()