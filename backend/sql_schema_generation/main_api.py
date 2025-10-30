"""
Schema Generation API Server
Flask API for database schema generation using FAISS RAG
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from schema_generator import SchemaGenerator
from analytics import schema_analytics
import logging
import time
from datetime import datetime
import sqlite3
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

# Initialize schema generator
schema_generator = SchemaGenerator()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Check if vector store is loaded
        vector_store_status = "available" if schema_generator.vector_store else "unavailable"
        
        # Check API clients
        groq_status = "available" if schema_generator.groq_client else "unavailable"
        cohere_status = "available" if schema_generator.cohere_client else "unavailable"
        
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "vector_store": vector_store_status,
                "groq_llm": groq_status,
                "cohere_rerank": cohere_status
            },
            "message": "Schema Generation API is running"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@app.route('/generate-schema', methods=['POST'])
def generate_schema():
    """Generate database schema from requirements"""
    start_time = time.time()
    
    try:
        # Validate request
        if not request.is_json:
            return jsonify({
                "success": False,
                "error": "Request must be JSON"
            }), 400
        
        data = request.get_json()
        requirements = data.get('requirements', '').strip()
        
        if not requirements:
            return jsonify({
                "success": False,
                "error": "Requirements field is required and cannot be empty"
            }), 400
        
        logger.info(f"Received schema generation request: {requirements[:100]}...")
        
        # Generate schema
        result = schema_generator.generate_schema(requirements)
        
        # Add API metadata
        result['api_response_time'] = time.time() - start_time
        result['timestamp'] = datetime.now().isoformat()
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error in schema generation: {error_msg}")
        
        return jsonify({
            "success": False,
            "error": error_msg,
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/analytics', methods=['GET'])
def get_analytics():
    """Get comprehensive schema generation analytics"""
    try:
        hours = request.args.get('hours', 24, type=int)
        stats = schema_analytics.get_performance_stats(hours)
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error getting analytics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/analytics/quality', methods=['GET'])
def get_quality_analytics():
    """Get schema quality analytics"""
    try:
        top_quality = schema_analytics.get_top_quality_schemas(limit=10)
        return jsonify({"top_quality_schemas": top_quality})
    except Exception as e:
        logger.error(f"Error getting quality analytics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/analytics/slow', methods=['GET'])
def get_slow_generations():
    """Get slow schema generations"""
    try:
        threshold = request.args.get('threshold', 10.0, type=float)
        slow_generations = schema_analytics.get_slow_generations(threshold=threshold)
        return jsonify({"slow_generations": slow_generations})
    except Exception as e:
        logger.error(f"Error getting slow generations: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/analytics/trends', methods=['GET'])
def get_usage_trends():
    """Get usage trends over time"""
    try:
        days = request.args.get('days', 7, type=int)
        trends = schema_analytics.get_usage_trends(days=days)
        return jsonify(trends)
    except Exception as e:
        logger.error(f"Error getting trends: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/analytics/export', methods=['GET'])
def export_analytics():
    """Export comprehensive analytics as JSON"""
    try:
        hours = request.args.get('hours', 24, type=int)
        analytics_json = schema_analytics.export_analytics(hours)
        
        from flask import Response
        return Response(
            analytics_json,
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename=schema_analytics_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'}
        )
    except Exception as e:
        logger.error(f"Error exporting analytics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/test-schema', methods=['GET'])
def test_schema_generation():
    """Test endpoint with sample schema generation"""
    sample_requirements = """
    Design a simple blog database schema with:
    - Users (authentication and profiles)
    - Blog posts with categories and tags
    - Comments and replies
    - Basic analytics tracking
    """
    
    try:
        result = schema_generator.generate_schema(sample_requirements)
        result['note'] = "This is a test endpoint with sample requirements"
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "note": "Test endpoint failed"
        }), 500

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        "error": "Endpoint not found",
        "available_endpoints": [
            "/health - Health check",
            "/generate-schema - Generate database schema (POST)",
            "/analytics - View generation analytics",
            "/test-schema - Test with sample requirements"
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        "error": "Internal server error",
        "message": "Please check the server logs for details"
    }), 500

def main():
    """Main function to run the Flask app"""
    # Check if vector store is available
    if not schema_generator.vector_store:
        logger.warning("⚠️ Vector store not available. Run db_setup.py first!")
        print("\n💡 To set up the schema generation system:")
        print("1. Ensure data.pdf is in the current directory")
        print("2. Run: python db_setup.py")
        print("3. Then restart this API server\n")
    
    print("🚀 Starting Schema Generation API Server...")
    print("📍 Available endpoints:")
    print("   GET  /health - Health check")
    print("   POST /generate-schema - Generate database schema")
    print("   GET  /analytics - View performance analytics")
    print("   GET  /analytics/quality - View quality analytics")
    print("   GET  /analytics/slow - View slow generations")
    print("   GET  /analytics/trends - View usage trends")
    print("   GET  /analytics/export - Export analytics data")
    print("   GET  /test-schema - Test endpoint")
    print("\n📖 API Documentation:")
    print("   POST /generate-schema")
    print("   Body: {\"requirements\": \"Your schema requirements here\"}")
    print("\n🌐 Starting server on http://localhost:5001")
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5001, debug=True)

if __name__ == "__main__":
    main()