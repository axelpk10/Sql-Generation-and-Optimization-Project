import { NextRequest, NextResponse } from "next/server";

const SQL_EXECUTION_URL =
  process.env.SQL_EXECUTION_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, engine = "trino", database } = body;

    if (!query) {
      return NextResponse.json(
        { error: "SQL query is required" },
        { status: 400 }
      );
    }

    let executeUrl = "";
    let requestBody: any = { query };

    // Add database to request if provided
    if (database) {
      requestBody.database = database;
    }

    // Route to appropriate execution engine
    switch (engine.toLowerCase()) {
      case "mysql":
        executeUrl = `${SQL_EXECUTION_URL}/execute/mysql`;
        break;
      case "trino":
        executeUrl = `${SQL_EXECUTION_URL}/execute/trino`;
        break;
      case "spark":
        executeUrl = `${SQL_EXECUTION_URL}/execute/spark`;
        break;
      case "postgresql":
        // PostgreSQL queries through Trino
        executeUrl = `${SQL_EXECUTION_URL}/execute/trino`;
        break;
      default:
        executeUrl = `${SQL_EXECUTION_URL}/execute/trino`;
    }

    const startTime = Date.now();

    // Execute query on your SQL execution service
    const response = await fetch(executeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const executionTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        {
          error: `SQL execution error: ${error}`,
          execution_time_ms: executionTime,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      results: result.results || result.data,
      columns: result.columns || result.column_names,
      execution_time_ms: executionTime,
      row_count: result.row_count || result.results?.length || 0,
      engine: engine,
      metadata: result.metadata || {},
    });
  } catch (error) {
    console.error("SQL execution API error:", error);
    return NextResponse.json(
      { error: "Internal server error during SQL execution" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "SQL execution API endpoint",
    engines: ["mysql", "trino", "spark"],
    status: "ready",
  });
}
