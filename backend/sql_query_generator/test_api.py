"""
Test file for FAISS-based SQL Query Generator
Tests all API endpoints and demonstrates model capabilities
"""

import requests
import json
import time
from pprint import pprint

# API Configuration
BASE_URL = "http://localhost:5000"
HEADERS = {"Content-Type": "application/json"}

class TrinoAPITester:
    """Test class for Trino SQL Query Generator API"""
    
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url
        self.test_results = []
    
    def print_separator(self, title):
        """Print a formatted separator for test sections"""
        print("\n" + "="*80)
        print(f"🧪 {title}")
        print("="*80)
    
    def test_health_check(self):
        """Test the health check endpoint"""
        self.print_separator("HEALTH CHECK TEST")
        
        try:
            response = requests.get(f"{self.base_url}/api/health")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Health Check Response:")
                pprint(data)
                
                # Check if FAISS is available
                if data.get("faiss_available"):
                    print("✅ FAISS vector store is available")
                else:
                    print("❌ FAISS vector store is NOT available")
            else:
                print(f"❌ Health check failed with status: {response.status_code}")
                
        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to the API. Make sure the Flask server is running!")
            return False
        except Exception as e:
            print(f"❌ Health check error: {str(e)}")
            return False
        
        return True
    
    def test_examples_endpoint(self):
        """Test the examples endpoint"""
        self.print_separator("EXAMPLES ENDPOINT TEST")
        
        try:
            response = requests.get(f"{self.base_url}/api/trino/examples")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Examples Response:")
                examples = data.get("data", {}).get("examples", [])
                
                for i, example in enumerate(examples, 1):
                    print(f"  {i}. {example}")
                
                print(f"\n📊 Total examples available: {len(examples)}")
            else:
                print(f"❌ Examples endpoint failed with status: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Examples endpoint error: {str(e)}")
    
    def test_context_retrieval(self, query):
        """Test the context retrieval endpoint"""
        self.print_separator(f"CONTEXT RETRIEVAL TEST: '{query}'")
        
        try:
            payload = {"user_query": query}
            response = requests.post(
                f"{self.base_url}/api/trino/context", 
                json=payload, 
                headers=HEADERS
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                context_docs = data.get("data", {}).get("context_documents", [])
                
                print(f"✅ Retrieved {len(context_docs)} context documents:")
                
                for i, doc in enumerate(context_docs, 1):
                    content = doc.get("content", "")
                    metadata = doc.get("metadata", {})
                    
                    print(f"\n📄 Document {i}:")
                    print(f"   Source: {metadata.get('source', 'Unknown')}")
                    print(f"   Content preview: {content[:200]}...")
                    
                return context_docs
            else:
                print(f"❌ Context retrieval failed with status: {response.status_code}")
                if response.text:
                    print(f"Error details: {response.text}")
                
        except Exception as e:
            print(f"❌ Context retrieval error: {str(e)}")
        
        return []
    
    def test_sql_generation(self, query):
        """Test the main SQL generation endpoint"""
        self.print_separator(f"SQL GENERATION TEST: '{query}'")
        
        try:
            payload = {"user_query": query}
            start_time = time.time()
            
            response = requests.post(
                f"{self.base_url}/api/trino/query", 
                json=payload, 
                headers=HEADERS
            )
            
            end_time = time.time()
            response_time = end_time - start_time
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Time: {response_time:.2f} seconds")
            
            if response.status_code == 200:
                data = response.json()
                result_data = data.get("data", {})
                
                print("\n✅ SQL Generation Successful!")
                print(f"📊 Retrieved documents count: {result_data.get('retrieved_docs_count', 'N/A')}")
                
                # Display generated query
                generated_query = result_data.get("generated_query", "")
                print("\n🔍 Generated SQL Query:")
                print("-" * 60)
                print(generated_query)
                print("-" * 60)
                
                # Display best practices
                best_practices = result_data.get("best_practices", "")
                if best_practices:
                    print("\n💡 Trino Best Practices:")
                    print("-" * 60)
                    print(best_practices)
                    print("-" * 60)
                
                # Display documentation context (truncated)
                doc_context = result_data.get("documentation_context", "")
                if doc_context:
                    print(f"\n📚 Documentation Context ({len(doc_context)} chars):")
                    print("-" * 60)
                    print(doc_context[:500] + "..." if len(doc_context) > 500 else doc_context)
                    print("-" * 60)
                
                return result_data
                
            else:
                print(f"❌ SQL generation failed with status: {response.status_code}")
                if response.text:
                    error_data = response.json()
                    print(f"Error: {error_data.get('message', 'Unknown error')}")
                
        except Exception as e:
            print(f"❌ SQL generation error: {str(e)}")
        
        return None
    
    def run_comprehensive_test(self):
        """Run a comprehensive test suite"""
        print("🚀 Starting Comprehensive Trino API Test Suite")
        print(f"⏰ Test started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Test 1: Health Check
        if not self.test_health_check():
            print("❌ Stopping tests - API is not available")
            return
        
        # Test 2: Examples Endpoint
        self.test_examples_endpoint()
        
        # Test queries for comprehensive testing
        test_queries = [
            "How to optimize Trino queries for large datasets?",
            "Create a query to join data from MySQL and Hive connectors",
            "How to use window functions in Trino for analytics?",
            "Write a query to process JSON arrays with UNNEST",
            "How to partition tables for better performance in Trino?"
        ]
        
        print(f"\n🎯 Testing {len(test_queries)} different query scenarios...")
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n{'='*20} TEST QUERY {i}/{len(test_queries)} {'='*20}")
            
            # Test context retrieval first
            context_docs = self.test_context_retrieval(query)
            
            # Then test full SQL generation
            result = self.test_sql_generation(query)
            
            # Brief pause between tests
            if i < len(test_queries):
                print("\n⏳ Waiting 2 seconds before next test...")
                time.sleep(2)
        
        print("\n" + "="*80)
        print("🎉 COMPREHENSIVE TEST SUITE COMPLETED!")
        print("="*80)
    
    def test_single_query(self, query):
        """Test a single query with detailed output"""
        print(f"🧪 Testing Single Query: '{query}'")
        
        # Health check first
        if not self.test_health_check():
            return
        
        # Test context retrieval
        context_docs = self.test_context_retrieval(query)
        
        # Test SQL generation
        result = self.test_sql_generation(query)
        
        return result


def main():
    """Main test function"""
    tester = TrinoAPITester()
    
    print("Welcome to the Trino SQL Query Generator Test Suite!")
    print("This will test all API endpoints and demonstrate model capabilities.")
    
    # Ask user what type of test to run
    print("\nChoose test type:")
    print("1. Quick health check")
    print("2. Test single custom query")
    print("3. Run comprehensive test suite")
    print("4. Test specific functionality")
    
    try:
        choice = input("\nEnter your choice (1-4): ").strip()
        
        if choice == "1":
            tester.test_health_check()
            
        elif choice == "2":
            query = input("Enter your Trino query: ").strip()
            if query:
                tester.test_single_query(query)
            else:
                print("❌ No query provided!")
                
        elif choice == "3":
            tester.run_comprehensive_test()
            
        elif choice == "4":
            print("\nFunctionality tests:")
            print("a. Context retrieval only")
            print("b. Examples endpoint only")
            print("c. Health check only")
            
            sub_choice = input("Enter sub-choice (a-c): ").strip().lower()
            
            if sub_choice == "a":
                query = input("Enter query for context retrieval: ").strip()
                if query:
                    tester.test_context_retrieval(query)
            elif sub_choice == "b":
                tester.test_examples_endpoint()
            elif sub_choice == "c":
                tester.test_health_check()
            else:
                print("❌ Invalid sub-choice!")
        else:
            print("❌ Invalid choice!")
            
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test error: {str(e)}")


if __name__ == "__main__":
    main()