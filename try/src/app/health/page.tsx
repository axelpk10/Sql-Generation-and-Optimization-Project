"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface ServiceHealth {
  name: string;
  url: string;
  status: "healthy" | "unhealthy" | "unreachable" | "error";
  statusCode?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  services: ServiceHealth[];
}

export default function HealthCheck() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/health");
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      console.error("Health check failed:", error);
      setHealthData({
        status: "error",
        timestamp: new Date().toISOString(),
        services: [],
      });
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "unhealthy":
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "unreachable":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "unhealthy":
      case "error":
        return "bg-red-500";
      case "unreachable":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Backend Health Check
          </h1>
          <p className="text-slate-600">
            Monitor the status of all backend services
          </p>
        </div>

        <div className="mb-6">
          <Button
            onClick={checkHealth}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Health
              </>
            )}
          </Button>
        </div>

        {healthData && (
          <div className="space-y-6">
            {/* Overall Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(healthData.status)}
                  Overall System Status
                  <Badge className={getStatusColor(healthData.status)}>
                    {healthData.status.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Last checked:{" "}
                  {new Date(healthData.timestamp).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            {/* Service Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {healthData.services.map((service, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getStatusIcon(service.status)}
                      {service.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <Badge className={getStatusColor(service.status)}>
                        {service.status.toUpperCase()}
                      </Badge>
                      <p className="text-xs text-slate-500 font-mono">
                        {service.url}
                      </p>
                      {service.statusCode && (
                        <p className="text-sm text-slate-600">
                          Status Code: {service.statusCode}
                        </p>
                      )}
                      {service.error && (
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          {service.error}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate max-w-none">
                  <p>To test the integrated system:</p>
                  <ol>
                    <li>
                      Ensure all backend services are running:
                      <ul>
                        <li>Schema Service on port 5001</li>
                        <li>Query Service on port 5000</li>
                        <li>SQL Execution on port 8000</li>
                      </ul>
                    </li>
                    <li>
                      If services show as &ldquo;unreachable&rdquo;, start them
                      using your backend setup
                    </li>
                    <li>
                      Once all services are healthy, test the AI Assistant and
                      SQL Editor
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
