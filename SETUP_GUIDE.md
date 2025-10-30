# 🚀 SQL Project - Complete Setup Guide

## 📋 Project Overview

This project implements a **Sequelizer Pro AI-Powered SQL Optimization Multi-Dialect Engine** with the following components:

- **SQL Execution Engine**: Multi-dialect SQL execution (MySQL, Trino, Apache Spark)
- **Query Generation Service**: AI-powered SQL query generation using FAISS RAG
- **Schema Generation Service**: Database schema generation from documents
- **API Gateway**: Unified routing for all microservices

## 🏗️ Architecture Overview

```
Frontend (Port: TBD) 
    ↓
API Gateway (Port: 3000)
    ↓
├── SQL Execution Engine (Port: 5000)
│   ├── MySQL (Docker: 3307→3306)
│   ├── Trino (Docker: 8080)
│   └── Apache Spark (Docker: 8081, 7077)
├── Query Generation Service (Port: 5002) ⚠️ Modified to avoid conflict
└── Schema Generation Service (Port: 5001)
```

⚠️ **PORT CONFLICT NOTICE:** SQL Execution and Query Generation both default to port 5000. 
We recommend running Query Generation on port 5002 to avoid conflicts.

## 🛠️ Prerequisites

### Required Software:
- **Python 3.8+**
- **Docker Desktop** (for SQL engines)
- **Node.js 16+** (for frontend development)
- **Git**

### Required API Keys:
- **Groq API Key** (for LLM)
- **Cohere API Key** (for reranking)

## 📁 Project Structure

```
SQL Project/
├── backend/                           # Backend microservices
│   ├── sql_query_generator/          # Query generation service
│   ├── sql_schema_generation/        # Schema generation service
│   ├── api_gateway.py               # API routing gateway
│   ├── requirements.txt             # Python dependencies
│   └── .env                         # Environment variables
├── SQL_Execution_New/               # SQL execution engine
│   ├── docker-compose.yml          # Container orchestration
│   ├── server.py                   # Flask API server
│   ├── spark/                      # Custom Spark setup
│   ├── trino/                      # Trino configuration
│   └── requirements.txt            # Python dependencies
├── SETUP_GUIDE.md                  # This file
├── TECHNICAL_DOCUMENTATION.md      # Technical details
└── RESEARCH_PAPER.md              # Research documentation
```

## � Quick Start Script

Create a `start_all_services.bat` file for Windows:

```batch
@echo off
echo Starting SQL Project Services...

echo 1. Starting Docker containers...
cd "SQL_Execution_New"
docker-compose up -d
timeout /t 20

echo 2. Starting SQL Execution Engine...
start cmd /k "venv\Scripts\activate && python server.py"

echo 3. Starting Schema Generation Service...
cd "..\backend\sql_schema_generation"
start cmd /k "..\venv\Scripts\activate && python main_api.py"

echo 4. Starting Query Generation Service (on port 5002)...
cd "..\sql_query_generator"
start cmd /k "..\venv\Scripts\activate && python faiss_main.py"

echo 5. Starting API Gateway...
cd ".."
start cmd /k "venv\Scripts\activate && python api_gateway.py"

echo All services started! Check each terminal window for status.
pause
```

## �🔧 Step-by-Step Setup

### Step 1: Clone and Navigate to Project

```bash
# Navigate to project directory
cd "C:\Users\PRANAY KUHITE\OneDrive\Desktop\SQL Project"
```

### Step 2: Environment Setup

#### 2.1 Backend Environment Variables

Create `.env` file in `backend/` directory:

```bash
# backend/.env
GROQ_API_KEY=your_groq_api_key_here
COHERE_API_KEY=your_cohere_api_key_here
```

### Step 3: SQL Execution Engine Setup

#### 3.1 Navigate to SQL Execution Directory

```bash
cd "SQL_Execution_New"
```

#### 3.2 Install Python Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

#### 3.3 Start Docker Containers

```bash
# Start all SQL engines (MySQL, Trino, Spark)
docker-compose up -d

# Wait 15-20 seconds for containers to fully start
# Verify containers are running
docker ps
```

**Expected Containers:**
- `mysql_db` (Port: 3307→3306)
- `trino_coordinator` (Port: 8080)
- `spark_master` (Port: 8081, 7077)
- `spark_worker`
- `postgres_db`
- `redis_cache`

#### 3.4 Start SQL Execution API

```bash
# In SQL_Execution_New directory with venv activated
python server.py
```

**Verification:** API should start on `http://localhost:5000`

### Step 4: Backend Services Setup

#### 4.1 Navigate to Backend Directory

```bash
cd "../backend"
```

#### 4.2 Install Backend Dependencies

```bash
# Create virtual environment (if not using existing one)
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

#### 4.3 Start Schema Generation Service

```bash
# In backend/sql_schema_generation directory
cd sql_schema_generation
python main_api.py
```

**Verification:** Service should start on `http://localhost:5001`

#### 4.4 Start Query Generation Service

⚠️ **IMPORTANT PORT CONFLICT:** Both SQL Execution and Query Generation services use port 5000.

**Option 1: Modify Query Generation Port (Recommended)**
```bash
# In backend/sql_query_generator directory
cd sql_query_generator

# Temporarily modify faiss_main.py to use port 5002
# Change line: app.run(debug=True, host='0.0.0.0', port=5000)
# To: app.run(debug=True, host='0.0.0.0', port=5002)

python faiss_main.py
```

**Option 2: Use Different Terminals/Environments**
- Run SQL Execution Engine independently
- Run Query Generation on a different machine/port

**For now, choose one service to run based on your testing needs:**
- **SQL Execution**: For testing database queries
- **Query Generation**: For testing AI-powered query generation

#### 4.5 Start API Gateway

```bash
# In backend directory (new terminal)
python api_gateway.py
```

**Verification:** Gateway should start on `http://localhost:3000`

## 🧪 Testing the Setup

### Test 1: SQL Execution Engine

```bash
# Test MySQL
curl -X POST http://localhost:5000/execute/mysql \
  -H "Content-Type: application/json" \
  -d '{"query": "SHOW TABLES"}'

# Test Trino
curl -X POST http://localhost:5000/execute/trino \
  -H "Content-Type: application/json" \
  -d '{"query": "SHOW TABLES"}'

# Test Spark
curl -X POST http://localhost:5000/execute/spark \
  -H "Content-Type: application/json" \
  -d '{"query": "SHOW TABLES"}'
```

### Test 2: API Gateway Health Check

```bash
curl http://localhost:3000/api/health
```

### Test 3: Schema Generation

```bash
curl -X POST http://localhost:3000/api/schema \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a simple e-commerce database"}'
```

## 🚨 Common Issues and Solutions

### Issue 1: Port Conflicts

**Problem:** Query Generation and SQL Execution both use port 5000
**Solution:** 
1. Modify `backend/sql_query_generator/faiss_main.py` line 369:
   ```python
   # Change from:
   app.run(debug=True, host='0.0.0.0', port=5000)
   # To:
   app.run(debug=True, host='0.0.0.0', port=5002)
   ```

2. Update `backend/api_gateway.py` to point to new port:
   ```python
   # Add new service endpoint:
   QUERY_SERVICE = "http://localhost:5002"
   ```

### Issue 2: Docker Containers Not Starting

**Problem:** Docker containers fail to start
**Solution:** 
- Ensure Docker Desktop is running
- Run `docker-compose down -v` then `docker-compose up -d`
- Check Docker logs: `docker-compose logs`

### Issue 3: API Key Errors

**Problem:** Groq or Cohere API errors
**Solution:** 
- Verify API keys in `.env` file
- Ensure you have valid API credits
- Check API key format

### Issue 4: Python Dependencies

**Problem:** Module import errors
**Solution:**
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt` again
- Check Python version (3.8+ required)

### Issue 5: FAISS Index Issues

**Problem:** FAISS index not found
**Solution:**
- Check if vector indexes exist in respective directories
- May need to run ingestion scripts first

## 📊 Service Endpoints

### SQL Execution Engine (Port: 5000)
- `POST /execute/mysql` - Execute MySQL queries
- `POST /execute/trino` - Execute Trino queries  
- `POST /execute/spark` - Execute Spark queries

### Schema Generation Service (Port: 5001)
- `POST /generate_schema` - Generate database schema
- `GET /analytics` - Schema generation analytics
- `GET /health` - Health check

### Query Generation Service (Port: 5002) ⚠️ Modified
- `POST /api/trino/query` - Generate optimized SQL queries
- `GET /api/trino/examples` - Get example queries
- `POST /api/trino/context` - Get context documents
- `GET /api/health` - Health check

**Note:** Port changed from 5000 to 5002 to avoid conflict with SQL Execution Engine

### API Gateway (Port: 3000)
- `GET /api/health` - Overall health check
- `POST /api/query` - Route to query generation
- `POST /api/schema` - Route to schema generation
- `GET /api/analytics/query` - Query analytics
- `GET /api/analytics/schema` - Schema analytics

## 🎯 Frontend Integration Points

When building the frontend, connect to these API Gateway endpoints:

### For Query Generation:
```javascript
const response = await fetch('http://localhost:3000/api/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_query: "Find all customers who bought products in the last month",
    context: "e-commerce database"
  })
});
```

### For Schema Generation:
```javascript
const response = await fetch('http://localhost:3000/api/schema', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: "Create a customer management database"
  })
});
```

### For SQL Execution:
```javascript
const response = await fetch('http://localhost:5000/execute/mysql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "SELECT * FROM customers LIMIT 10"
  })
});
```

## 🔄 Development Workflow

1. **Start Docker Containers** (SQL Execution Engine)
2. **Start Backend Services** (Schema + Query Generation)
3. **Start API Gateway** (Central routing)
4. **Develop Frontend** (Connect to API Gateway)
5. **Test Integration** (End-to-end workflow)

## 📝 Notes for Frontend Developer

- All backend services are **CORS-enabled** for frontend integration
- **Database starts empty** - users must upload data or generate schemas
- **API responses are JSON formatted** with consistent error handling
- **Authentication/Authorization** - Not implemented yet (add if needed)
- **File uploads** - Schema generation supports document uploads

## 🆘 Support

If you encounter issues:

1. **Check logs** in each service terminal
2. **Verify all containers are running**: `docker ps`
3. **Test individual services** before integration
4. **Check environment variables** in `.env` files
5. **Ensure all dependencies are installed**

## 🎉 Success Indicators

✅ **All Docker containers running**
✅ **SQL Execution API responding on port 5000**
✅ **Schema Generation API responding on port 5001**
✅ **API Gateway responding on port 3000**
✅ **All health checks passing**
✅ **Sample queries executing successfully**

**You're ready to build the frontend!** 🚀

## 📞 Contact

For technical questions about the setup, refer to:
- `TECHNICAL_DOCUMENTATION.md` - Detailed technical specs
- `RESEARCH_PAPER.md` - Research and methodology
- Service-specific README files in each directory

---

**Good luck with the frontend development!** 🎯