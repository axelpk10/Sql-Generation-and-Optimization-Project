from pyspark.sql import SparkSession
import sys
import json
import re
import traceback
from datetime import datetime, timezone

def execute_query(query):
    # Create a SparkSession with MySQL connector
    spark = SparkSession.builder \
        .appName("ExecuteQuery") \
        .config("spark.jars", "/opt/spark/jars/mysql-connector-java.jar") \
        .getOrCreate()
    
    try:
        # Extract the table name if it's a simple query
        match = re.search(r'FROM\s+(\w+)', query, re.IGNORECASE)
        
        if match:
            table_name = match.group(1)
            
            # Load the table data
            jdbc_df = spark.read \
                .format("jdbc") \
                .option("url", "jdbc:mysql://mysql_db:3306/sales") \
                .option("dbtable", table_name) \
                .option("user", "admin") \
                .option("password", "admin") \
                .option("driver", "com.mysql.cj.jdbc.Driver") \
                .load()
            
            # Create a temporary view
            jdbc_df.createOrReplaceTempView(table_name)
        
        # Execute the query
        result_df = spark.sql(query)
        
        # Check if this is a DDL/DML query by attempting to collect results
        # DDL/DML queries will return empty DataFrame with no schema
        try:
            # Try to get schema - if None or empty, this is likely DDL/DML
            if result_df.schema is None or len(result_df.schema.fields) == 0:
                # DDL/DML query (CREATE, INSERT, UPDATE, DELETE, etc.)
                query_upper = query.upper().strip()
                query_type = 'Query'
                if query_upper.startswith('CREATE'):
                    query_type = 'CREATE'
                elif query_upper.startswith('INSERT'):
                    query_type = 'INSERT'
                elif query_upper.startswith('UPDATE'):
                    query_type = 'UPDATE'
                elif query_upper.startswith('DELETE'):
                    query_type = 'DELETE'
                elif query_upper.startswith('DROP'):
                    query_type = 'DROP'
                elif query_upper.startswith('ALTER'):
                    query_type = 'ALTER'
                elif query_upper.startswith('TRUNCATE'):
                    query_type = 'TRUNCATE'
                
                response = {
                    "success": True,
                    "message": f"{query_type} executed successfully",
                    "query_type": query_type,
                    "affected_rows": 0  # Spark doesn't always provide this info
                }
                print(json.dumps(response))
                return True
        except:
            pass  # Continue to normal result processing
        
        # SELECT query - get results
        schema = [{"name": field.name, "type": str(field.dataType)} for field in result_df.schema.fields]
        
        # Collect results
        results = []
        for row in result_df.collect():
            row_dict = row.asDict()
            # Convert any non-serializable types to strings
            for key, value in row_dict.items():
                if value is not None and not isinstance(value, (str, int, float, bool)):
                    row_dict[key] = str(value)
            results.append(list(row_dict.values()))
        
        # Prepare response for SELECT query
        response = {
            "status": "success",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "query": query,
            "schema": schema,
            "count": len(results),
            "results": results,
            "columns": [field["name"] for field in schema],
            "row_count": len(results)
        }
        
        # Print ONLY the JSON results - nothing else to stdout
        print(json.dumps(response))
        
        return True
    except Exception as e:
        error_details = {
            "status": "error",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "query": query,
            "error": str(e)
        }
        print(json.dumps(error_details))
        return False
    finally:
        # Always stop the SparkSession
        spark.stop()

if __name__ == "__main__":
    # Get the query from command line arguments
    if len(sys.argv) > 1:
        query = sys.argv[1]
        execute_query(query)
    else:
        error_response = {
            "status": "error",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "error": "No query provided"
        }
        print(json.dumps(error_response))