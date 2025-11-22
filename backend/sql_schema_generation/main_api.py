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
    """Generate database schema from requirements with multi-dialect support"""
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
        dialect = data.get('dialect', 'postgresql').lower()
        
        # NEW: Accept project context from frontend
        project_id = data.get('project_id')
        project_name = data.get('project_name')
        
        # Log context received
        if project_id:
            logger.info(f"📋 Processing schema generation for project: {project_name} (ID: {project_id})")
        
        # Validate requirements
        if not requirements:
            return jsonify({
                "success": False,
                "error": "Requirements field is required and cannot be empty"
            }), 400
        
        # Validate dialect
        supported_dialects = ['mysql', 'postgresql', 'trino', 'spark']
        if dialect not in supported_dialects:
            return jsonify({
                "success": False,
                "error": f"Unsupported dialect: {dialect}. Supported dialects: {', '.join(supported_dialects)}"
            }), 400
        
        logger.info(f"Received schema generation request for {dialect}: {requirements[:100]}...")
        
        # Generate schema with dialect support
        result = schema_generator.generate_schema(requirements, dialect)
        
        # Add API metadata
        result['api_response_time'] = time.time() - start_time
        result['timestamp'] = datetime.now().isoformat()
        result['project_id'] = project_id
        result['project_name'] = project_name
        
        # TODO: Save conversation to Redis via SQL Execution backend
        # if project_id:
        #     session_id = data.get("session_id", "default_session")
        #     save_ai_conversation(project_id, session_id, requirements, result)
        
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




@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        "error": "Endpoint not found",
        "available_endpoints": [
            "/health - Health check",
            "/generate-schema - Generate database schema (POST)",
            "/analytics - View generation analytics"
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
    print("\n📖 API Documentation:")
    print("   POST /generate-schema")
    print("   Body: {\"requirements\": \"Your schema requirements here\"}")
    print("\n🌐 Starting server on http://localhost:5001")
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5001, debug=True)

if __name__ == "__main__":
    main()