"""
Test Analytics System for Schema Generation
Quick test to verify all analytics functionality
"""

from analytics import schema_analytics
import json
from datetime import datetime

def test_analytics():
    """Test comprehensive analytics functionality"""
    print("🧪 Testing Schema Generation Analytics System")
    print("=" * 60)
    
    # Test 1: Log some sample schema generations
    print("📝 Logging sample schema generations...")
    
    sample_schemas = [
        {
            "requirements": "Create a user management system with authentication",
            "schema": """CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_username ON users(username);
            CREATE INDEX idx_email ON users(email);""",
            "explanation": "User table with proper constraints and indexing",
            "optimizations": "Consider partitioning for large user bases",
            "response_time": 3.2,
            "complexity": "medium"
        },
        {
            "requirements": "Design e-commerce product catalog",
            "schema": """CREATE TABLE categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                parent_id INTEGER REFERENCES categories(id)
            );
            
            CREATE TABLE products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category_id INTEGER REFERENCES categories(id),
                price DECIMAL(10,2) NOT NULL,
                stock_quantity INTEGER DEFAULT 0
            );""",
            "explanation": "Hierarchical categories with product relationships",
            "optimizations": "Use materialized paths for category hierarchy",
            "response_time": 5.7,
            "complexity": "complex"
        },
        {
            "requirements": "Simple blog post table",
            "schema": """CREATE TABLE posts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                published_at TIMESTAMP
            );""",
            "explanation": "Basic blog post structure",
            "optimizations": "Add full-text search indexes",
            "response_time": 1.8,
            "complexity": "simple"
        }
    ]
    
    schema_ids = []
    for i, schema in enumerate(sample_schemas):
        schema_id = schema_analytics.log_schema_generation(
            requirements=schema["requirements"],
            schema_content=schema["schema"],
            explanation=schema["explanation"],
            optimizations=schema["optimizations"],
            response_time=schema["response_time"],
            docs_retrieved=5,
            docs_used=3,
            success=True,
            user_id=f"test_user_{i}"
        )
        schema_ids.append(schema_id)
        print(f"   ✅ Logged schema {i+1}: {schema_id}")
    
    # Test 2: Get performance statistics
    print("\n📊 Getting performance statistics...")
    stats = schema_analytics.get_performance_stats(24)
    
    print(f"   📈 Total schemas generated: {stats['overall']['total_schemas']}")
    print(f"   ⏱️  Average response time: {stats['overall']['avg_response_time']:.2f}s")
    print(f"   🎯 Success rate: {stats['overall']['success_rate']:.1f}%")
    print(f"   🏗️  Average complexity: {stats['overall']['avg_complexity']:.1f} tables")
    
    # Test 3: Category analysis
    print("\n🏷️  Schema categories:")
    for category in stats['by_category']:
        print(f"   📁 {category['category']}: {category['count']} schemas")
    
    # Test 4: Quality analysis
    print("\n⭐ Getting quality analytics...")
    quality_schemas = schema_analytics.get_top_quality_schemas(5)
    
    for i, schema in enumerate(quality_schemas):
        print(f"   🏆 #{i+1}: Quality Score {schema['quality_score']:.1f} - {schema['requirements'][:50]}...")
    
    # Test 5: Performance analysis
    print("\n🐌 Checking slow generations...")
    slow_gens = schema_analytics.get_slow_generations(threshold=3.0, limit=3)
    
    for slow in slow_gens:
        print(f"   ⏳ {slow['response_time']:.1f}s - {slow['requirements'][:50]}...")
    
    # Test 6: Export analytics
    print("\n💾 Exporting analytics...")
    export_data = schema_analytics.export_analytics(24)
    
    try:
        # Parse to verify it's valid JSON
        parsed = json.loads(export_data)
        print(f"   ✅ Export successful! {len(export_data)} characters")
        print(f"   📅 Generated at: {parsed['generated_at']}")
    except Exception as e:
        print(f"   ❌ Export failed: {e}")
    
    # Test 7: Usage trends
    print("\n📈 Getting usage trends...")
    trends = schema_analytics.get_usage_trends(7)
    
    if trends['daily_trends']:
        print(f"   📊 Daily trend data available for {len(trends['daily_trends'])} days")
        latest = trends['daily_trends'][0]
        print(f"   📅 Latest: {latest['date']} - {latest['schemas_generated']} schemas")
    else:
        print("   📊 No trend data available yet")
    
    print("\n" + "=" * 60)
    print("✅ Analytics system test completed successfully!")
    
    return schema_ids

if __name__ == "__main__":
    test_analytics()