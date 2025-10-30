"""
Simple Model Testing Script
Quick test to see SQL generation quality and response times
"""

import requests
import json
import time

def test_model_query(query, show_context=False):
    """Test a single query and display the results nicely"""
    
    print(f"\n{'='*60}")
    print(f"🔍 TESTING QUERY: {query}")
    print(f"{'='*60}")
    
    try:
        # Send request to API
        payload = {"user_query": query}
        start_time = time.time()
        
        response = requests.post(
            "http://localhost:5000/api/trino/query",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        if response.status_code == 200:
            data = response.json()
            result = data.get("data", {})
            
            print(f"✅ SUCCESS! (Response time: {response_time:.2f}s)")
            print(f"📊 Documents retrieved: {result.get('retrieved_docs_count', 'N/A')}")
            
            # Show generated SQL
            print(f"\n🛠️ GENERATED SQL:")
            print("-" * 50)
            generated_query = result.get("generated_query", "No query generated")
            print(generated_query)
            print("-" * 50)
            
            # Show best practices
            best_practices = result.get("best_practices", "")
            if best_practices:
                print(f"\n💡 BEST PRACTICES:")
                print("-" * 50)
                print(best_practices)
                print("-" * 50)
            
            # Show context if requested
            if show_context:
                doc_context = result.get("documentation_context", "")
                if doc_context:
                    print(f"\n📚 CONTEXT USED (first 300 chars):")
                    print("-" * 50)
                    print(doc_context[:300] + "...")
                    print("-" * 50)
            
        else:
            print(f"❌ FAILED! Status: {response.status_code}")
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API! Make sure Flask server is running on localhost:5000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def quick_test_suite():
    """Run a quick test with common Trino queries"""
    
    print("🚀 QUICK MODEL TEST SUITE")
    print("Testing common Trino SQL scenarios...")
    
    test_queries = [
        "How to create a partitioned table in Trino?",
        "Write a query to join MySQL and Hive data sources",
        "How to optimize a query with large JSON processing?",
        "Show me window functions for time series analysis",
        "How to use UNNEST with array data in Trino?"
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n🧪 TEST {i}/{len(test_queries)}")
        test_model_query(query)
        
        # Small delay between tests
        if i < len(test_queries):
            time.sleep(1)
    
    print(f"\n{'='*60}")
    print("🎉 QUICK TEST SUITE COMPLETED!")
    print(f"{'='*60}")

def main():
    """Main function for interactive testing"""
    
    print("🧪 Trino SQL Model Tester")
    print("Options:")
    print("1. Test a custom query")
    print("2. Run quick test suite")
    print("3. Test with context display")
    
    try:
        choice = input("\nChoose option (1-3): ").strip()
        
        if choice == "1":
            query = input("Enter your Trino query: ").strip()
            if query:
                test_model_query(query)
            else:
                print("No query provided!")
                
        elif choice == "2":
            quick_test_suite()
            
        elif choice == "3":
            query = input("Enter your Trino query: ").strip()
            if query:
                test_model_query(query, show_context=True)
            else:
                print("No query provided!")
        else:
            print("Invalid choice!")
            
    except KeyboardInterrupt:
        print("\n\nTest interrupted!")

if __name__ == "__main__":
    main()