"""
Unified API Gateway for SQL Project
Routes requests to appropriate microservices
"""

from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
import requests
import logging

app = Flask(__name__)
CORS(app)

# Service endpoints
QUERY_SERVICE = "http://localhost:5000"
SCHEMA_SERVICE = "http://localhost:5001"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check for the gateway"""
    try:
        # Check both services
        query_health = requests.get(f"{QUERY_SERVICE}/health", timeout=5)
        schema_health = requests.get(f"{SCHEMA_SERVICE}/health", timeout=5)
        
        return jsonify({
            "gateway": "healthy",
            "services": {
                "query_generator": query_health.status_code == 200,
                "schema_generator": schema_health.status_code == 200
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/query', methods=['POST'])
def generate_query():
    """Route to SQL query generation service"""
    try:
        response = requests.post(f"{QUERY_SERVICE}/generate", 
                               json=request.json, 
                               timeout=30)
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/schema', methods=['POST'])
def generate_schema():
    """Route to schema generation service"""
    try:
        response = requests.post(f"{SCHEMA_SERVICE}/generate_schema", 
                               json=request.json, 
                               timeout=30)
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics/query', methods=['GET'])
def query_analytics():
    """Route to query service analytics"""
    try:
        response = requests.get(f"{QUERY_SERVICE}/analytics")
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics/schema', methods=['GET'])
def schema_analytics():
    """Route to schema service analytics"""
    try:
        response = requests.get(f"{SCHEMA_SERVICE}/analytics")
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info("🚀 Starting SQL Project API Gateway")
    logger.info("Query Service: http://localhost:5000")
    logger.info("Schema Service: http://localhost:5001")
    logger.info("Gateway: http://localhost:3000")
    
    app.run(host='0.0.0.0', port=3000, debug=True)