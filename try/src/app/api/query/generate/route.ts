import { NextRequest, NextResponse } from "next/server";

const QUERY_SERVICE_URL =
  process.env.QUERY_SERVICE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to your FAISS query service
    const response = await fetch(`${QUERY_SERVICE_URL}/api/trino/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_query: body.user_query,
        project_context: body.project_context,
        dialect: body.dialect || "trino",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Query service error: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      generated_query: result.data?.generated_query || result.generated_query,
      best_practices: result.data?.best_practices,
      documentation_context: result.data?.documentation_context,
      metadata: result.metadata || {},
    });
  } catch (error) {
    console.error("Query generation API error:", error);
    return NextResponse.json(
      { error: "Internal server error during query generation" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Query generation API endpoint",
    status: "ready",
  });
}
