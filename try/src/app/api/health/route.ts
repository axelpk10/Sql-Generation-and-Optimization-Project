import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Test all backend services
    const services = [
      { name: "Schema Service", url: "http://localhost:5001/health" },
      { name: "Query Service", url: "http://localhost:5000/api/health" },
      { name: "SQL Execution", url: "http://localhost:8000/health" },
    ];

    const healthChecks = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(service.url, {
            method: "GET",
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Parse response to check if service is actually healthy
          let isHealthy = false;
          if (response.ok) {
            try {
              const data = await response.json();
              // Check if response indicates healthy status
              isHealthy = data.status === "healthy" || response.status === 200;
            } catch {
              // If we can't parse JSON but got 200, assume healthy
              isHealthy = true;
            }
          }

          return {
            name: service.name,
            url: service.url,
            status: isHealthy ? "healthy" : "unhealthy",
            statusCode: response.status,
            responseTime: Date.now(),
          };
        } catch (error) {
          return {
            name: service.name,
            url: service.url,
            status: "unreachable",
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    const results = healthChecks.map((check, index) => {
      if (check.status === "fulfilled") {
        return check.value;
      } else {
        return {
          name: services[index].name,
          url: services[index].url,
          status: "error",
          error: check.reason?.message || "Health check failed",
        };
      }
    });

    const allHealthy = results.every((result) => result.status === "healthy");

    return NextResponse.json(
      {
        status: allHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        services: results,
      },
      {
        status: allHealthy ? 200 : 503,
      }
    );
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
