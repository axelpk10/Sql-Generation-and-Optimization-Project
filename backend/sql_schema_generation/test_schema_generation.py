"""
Test Schema Generation System
Comprehensive testing for FAISS-based schema generation
"""

import sys
import time
from pathlib import Path
from schema_generator import SchemaGenerator
from schema_analyzer import SchemaAnalyzer
import json

class SchemaGenerationTester:
    """Test suite for schema generation system"""
    
    def __init__(self):
        self.generator = SchemaGenerator()
        self.analyzer = SchemaAnalyzer()
        self.test_results = []
    
    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🧪 Starting Schema Generation Test Suite")
        print("=" * 50)
        
        tests = [
            self.test_vector_store_loading,
            self.test_document_retrieval,
            self.test_schema_generation_simple,
            self.test_schema_generation_complex,
            self.test_schema_analysis,
            self.test_performance_benchmarks
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                print(f"\n🔬 Running: {test.__name__}")
                result = test()
                if result:
                    print(f"✅ PASSED: {test.__name__}")
                    passed += 1
                else:
                    print(f"❌ FAILED: {test.__name__}")
                    failed += 1
                    
                self.test_results.append({
                    'test': test.__name__,
                    'status': 'PASSED' if result else 'FAILED',
                    'timestamp': time.time()
                })
                
            except Exception as e:
                print(f"💥 ERROR in {test.__name__}: {str(e)}")
                failed += 1
                self.test_results.append({
                    'test': test.__name__,
                    'status': 'ERROR',
                    'error': str(e),
                    'timestamp': time.time()
                })
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results Summary:")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        return passed, failed
    
    def test_vector_store_loading(self):
        """Test FAISS vector store loading"""
        try:
            if not self.generator.vector_store:
                print("❌ Vector store not loaded")
                return False
            
            print("✅ Vector store loaded successfully")
            
            # Test basic retrieval
            test_docs = self.generator.vector_store.similarity_search("database schema", k=3)
            if len(test_docs) > 0:
                print(f"✅ Retrieved {len(test_docs)} test documents")
                return True
            else:
                print("❌ No documents retrieved in test")
                return False
                
        except Exception as e:
            print(f"❌ Vector store test failed: {str(e)}")
            return False
    
    def test_document_retrieval(self):
        """Test document retrieval functionality"""
        try:
            test_queries = [
                "table design best practices",
                "database normalization",
                "indexing strategies",
                "primary key constraints"
            ]
            
            for query in test_queries:
                docs = self.generator.retrieve_relevant_docs(query, k=3)
                if not docs:
                    print(f"❌ No documents retrieved for: {query}")
                    return False
                print(f"✅ Retrieved {len(docs)} docs for: {query[:30]}...")
            
            return True
            
        except Exception as e:
            print(f"❌ Document retrieval test failed: {str(e)}")
            return False
    
    def test_schema_generation_simple(self):
        """Test simple schema generation"""
        try:
            requirements = """
            Create a simple user management system with:
            - User table with basic authentication
            - Profile information storage
            - Login tracking
            """
            
            print(f"Testing with: {requirements[:50]}...")
            result = self.generator.generate_schema(requirements)
            
            if not result.get('success'):
                print(f"❌ Schema generation failed: {result.get('error')}")
                return False
            
            schema = result.get('schema', '')
            if not schema:
                print("❌ No schema generated")
                return False
            
            # Check for basic SQL elements
            if 'CREATE TABLE' not in schema.upper():
                print("❌ No CREATE TABLE statements found")
                return False
            
            print(f"✅ Generated schema ({len(schema)} characters)")
            print(f"⏱️ Response time: {result.get('response_time', 0):.2f}s")
            
            return True
            
        except Exception as e:
            print(f"❌ Simple schema generation test failed: {str(e)}")
            return False
    
    def test_schema_generation_complex(self):
        """Test complex schema generation"""
        try:
            requirements = """
            Design a comprehensive e-commerce database with:
            - Customer management (users, addresses, payment methods)
            - Product catalog (categories, variants, inventory)
            - Order processing (cart, orders, payments, shipping)
            - Reviews and ratings system
            - Analytics and reporting tables
            - Multi-tenant architecture support
            
            Requirements:
            - High performance for read-heavy workloads
            - ACID compliance for financial transactions
            - Scalable design for millions of products
            - Audit trail for all critical operations
            """
            
            print(f"Testing complex schema generation...")
            start_time = time.time()
            result = self.generator.generate_schema(requirements)
            end_time = time.time()
            
            if not result.get('success'):
                print(f"❌ Complex schema generation failed: {result.get('error')}")
                return False
            
            schema = result.get('schema', '')
            explanation = result.get('explanation', '')
            optimizations = result.get('optimizations', '')
            
            # Validate schema content
            table_count = schema.upper().count('CREATE TABLE')
            if table_count < 5:
                print(f"❌ Expected multiple tables, got {table_count}")
                return False
            
            # Check for performance considerations
            performance_keywords = ['INDEX', 'PARTITION', 'CONSTRAINT', 'PRIMARY KEY']
            if not any(keyword in schema.upper() for keyword in performance_keywords):
                print("❌ Schema lacks performance optimizations")
                return False
            
            print(f"✅ Complex schema generated successfully")
            print(f"📊 Tables created: {table_count}")
            print(f"📝 Schema length: {len(schema)} characters")
            print(f"💡 Explanation length: {len(explanation)} characters")
            print(f"⚡ Optimizations length: {len(optimizations)} characters")
            print(f"⏱️ Total time: {end_time - start_time:.2f}s")
            
            return True
            
        except Exception as e:
            print(f"❌ Complex schema generation test failed: {str(e)}")
            return False
    
    def test_schema_analysis(self):
        """Test schema analysis functionality"""
        try:
            # Generate a test schema first
            requirements = "Simple blog system with users, posts, and comments"
            result = self.generator.generate_schema(requirements)
            
            if not result.get('success'):
                print("❌ Cannot test analysis - schema generation failed")
                return False
            
            schema = result.get('schema', '')
            
            # Analyze the generated schema
            analysis = self.analyzer.analyze_ddl_statements(schema)
            
            if analysis.total_tables == 0:
                print("❌ No tables found in analysis")
                return False
            
            print(f"✅ Schema analysis completed")
            print(f"📊 Tables analyzed: {analysis.total_tables}")
            print(f"📈 Performance score: {analysis.performance_score:.1f}/100")
            print(f"⚠️ Issues found: {analysis.issues_found}")
            
            return True
            
        except Exception as e:
            print(f"❌ Schema analysis test failed: {str(e)}")
            return False
    
    def test_performance_benchmarks(self):
        """Test performance benchmarks"""
        try:
            test_cases = [
                "Simple user table",
                "E-commerce product catalog", 
                "Financial transaction system",
                "Social media platform database",
                "Analytics and reporting system"
            ]
            
            total_time = 0
            successful_generations = 0
            
            for i, case in enumerate(test_cases, 1):
                print(f"📊 Benchmark {i}/{len(test_cases)}: {case}")
                
                start_time = time.time()
                result = self.generator.generate_schema(f"Design a {case}")
                end_time = time.time()
                
                response_time = end_time - start_time
                total_time += response_time
                
                if result.get('success'):
                    successful_generations += 1
                    print(f"   ✅ {response_time:.2f}s")
                else:
                    print(f"   ❌ Failed: {result.get('error', 'Unknown error')}")
            
            avg_time = total_time / len(test_cases)
            success_rate = (successful_generations / len(test_cases)) * 100
            
            print(f"\n📈 Performance Summary:")
            print(f"   Average response time: {avg_time:.2f}s")
            print(f"   Success rate: {success_rate:.1f}%")
            print(f"   Total test time: {total_time:.2f}s")
            
            # Performance criteria
            if avg_time > 10.0:
                print("⚠️ Average response time exceeds 10 seconds")
                return False
            
            if success_rate < 80:
                print("⚠️ Success rate below 80%")
                return False
            
            print("✅ Performance benchmarks passed")
            return True
            
        except Exception as e:
            print(f"❌ Performance benchmark test failed: {str(e)}")
            return False
    
    def save_test_results(self):
        """Save test results to file"""
        try:
            results_file = Path(__file__).parent / "test_results.json"
            with open(results_file, 'w') as f:
                json.dump({
                    'timestamp': time.time(),
                    'test_results': self.test_results
                }, f, indent=2)
            
            print(f"📁 Test results saved to: {results_file}")
            
        except Exception as e:
            print(f"⚠️ Could not save test results: {str(e)}")

def main():
    """Run the test suite"""
    print("🚀 Schema Generation System Testing")
    print("=" * 50)
    
    # Check prerequisites
    current_dir = Path(__file__).parent
    faiss_index_path = current_dir / "schema_faiss_index"
    data_pdf_path = current_dir / "data.pdf"
    
    if not data_pdf_path.exists():
        print(f"❌ Required file missing: {data_pdf_path}")
        print("💡 Please ensure data.pdf is in the current directory")
        sys.exit(1)
    
    if not faiss_index_path.exists():
        print(f"⚠️ FAISS index not found: {faiss_index_path}")
        print("💡 Run db_setup.py first to create the vector store")
        print("   Command: python db_setup.py")
        sys.exit(1)
    
    # Run tests
    tester = SchemaGenerationTester()
    passed, failed = tester.run_all_tests()
    
    # Save results
    tester.save_test_results()
    
    # Exit with appropriate code
    if failed == 0:
        print("\n🎉 All tests passed! Schema generation system is ready.")
        sys.exit(0)
    else:
        print(f"\n⚠️ {failed} test(s) failed. Please review the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()