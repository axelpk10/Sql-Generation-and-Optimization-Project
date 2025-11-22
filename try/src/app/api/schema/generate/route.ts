import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to your schema service
    const response = await fetch("http://localhost:5001/generate-schema", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requirements:
          body.prompt || body.description || body.requirements || "",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Schema service error: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      schema: result.schema || result.generated_schema,
      metadata: result.metadata || {},
    });
  } catch (error) {
    console.error("Schema generation API error:", error);
    return NextResponse.json(
      { error: "Internal server error during schema generation" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Schema generation API endpoint",
    status: "ready",
  });
}
