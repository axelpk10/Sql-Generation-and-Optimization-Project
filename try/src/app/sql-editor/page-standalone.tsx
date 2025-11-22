"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Database,
  Play,
  History,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Settings,
} from "lucide-react";
import { MonacoEditor } from "./components/MonacoEditor";
import { SchemaPanel } from "./components/SchemaPanel";
import { QueryHistory } from "./components/QueryHistory";
import { ResultsPanel } from "./components/ResultsPanel";
import { CsvUpload } from "./components/CsvUpload";

interface QueryResult {
  columns: string[];
  results: Record<string, unknown>[];
  executionTime: number;
  rowCount: number;
}

interface DatabaseConfig {
  dialect: "mysql" | "postgresql" | "trino" | "spark";
  database: string;
}

export default function SQLEditor() {
  const router = useRouter();

  // Database configuration state
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    dialect: "mysql",
    database: "sales",
  });
  const [showConfig, setShowConfig] = useState(false);

  // Query execution state
  const [query, setQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Schema and history state (local only)
  const [schema, setSchema] = useState<any>(null);
  const [queryHistoryData, setQueryHistoryData] = useState<any[]>([]);

  // Database configuration options
  const dialectOptions = [
    { value: "mysql", label: "MySQL" },
    { value: "postgresql", label: "PostgreSQL" },
    { value: "trino", label: "Trino" },
    { value: "spark", label: "Spark SQL" },
  ];

  const databaseOptions = {
    mysql: ["sales", "inventory", "customers"],
    postgresql: ["analytics", "warehouse", "reporting"],
    trino: ["federated", "lakehouse", "catalog"],
    spark: ["default", "delta", "analytics"],
  };

  // Helper function to get the correct execution endpoint
  const getExecutionEndpoint = (dialect: string) => {
    const endpoints = {
      mysql: "/api/execute/mysql",
      postgresql: "/api/execute/postgresql",
      trino: "/api/execute/trino",
      spark: "/api/execute/spark",
    };
    return endpoints[dialect as keyof typeof endpoints] || endpoints.mysql;
  };

  // Discover database schema
  const handleDiscoverSchema = async () => {
    setIsLoadingSchema(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/schema/discover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dialect: dbConfig.dialect,
            database: dbConfig.database,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSchema(result.schema);
      } else {
        const error = await response.json();
        console.error("Schema discovery failed:", error);
      }
    } catch (error) {
      console.error("Schema discovery error:", error);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  // Execute SQL query
  const executeQuery = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const startTime = Date.now();
      const endpoint = getExecutionEndpoint(dbConfig.dialect);

      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          database: dbConfig.database,
        }),
      });

      const executionTime = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        const queryData = {
          columns: result.columns || [],
          results: result.results || [],
          executionTime,
          rowCount: result.rowCount || result.results?.length || 0,
        };

        setQueryResult(queryData);

        // Add to local query history
        const historyEntry = {
          id: crypto.randomUUID(),
          query,
          result: queryData,
          executedAt: new Date().toISOString(),
          status: "success",
          executionTime,
        };
        setQueryHistoryData((prev) => [historyEntry, ...prev.slice(0, 49)]); // Keep last 50 queries
      } else {
        const error = await response.json();
        setQueryError(error.error || "Query execution failed");

        // Add error to history
        const historyEntry = {
          id: crypto.randomUUID(),
          query,
          result: null,
          executedAt: new Date().toISOString(),
          status: "error",
          executionTime,
          error: error.error,
        };
        setQueryHistoryData((prev) => [historyEntry, ...prev.slice(0, 49)]);
      }
    } catch (error) {
      setQueryError("Network error: Could not connect to execution service");
      console.error("Query execution error:", error);
    } finally {
      setIsExecuting(false);
    }
  };

  // Load schema on component mount or when config changes
  useEffect(() => {
    handleDiscoverSchema();
  }, [dbConfig]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur border-b border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="text-gray-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center space-x-3">
              <Database className="h-6 w-6 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">SQL Editor</h1>
                <p className="text-sm text-gray-400">
                  {dbConfig.dialect.toUpperCase()} - {dbConfig.database}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Database Configuration */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="border-gray-600 text-gray-300 hover:text-white"
            >
              <Settings className="h-4 w-4 mr-2" />
              Config
            </Button>

            {/* Dialect Badge */}
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              {dbConfig.dialect.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Database Configuration Panel */}
        {showConfig && (
          <div className="border-t border-gray-700 px-6 py-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">
                  Database Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dialect" className="text-gray-300">
                      Database Dialect
                    </Label>
                    <Select
                      value={dbConfig.dialect}
                      onValueChange={(value: any) =>
                        setDbConfig((prev) => ({
                          ...prev,
                          dialect: value,
                          database:
                            databaseOptions[
                              value as keyof typeof databaseOptions
                            ][0],
                        }))
                      }
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        {dialectOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="text-white focus:bg-gray-600"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="database" className="text-gray-300">
                      Database Name
                    </Label>
                    <Select
                      value={dbConfig.database}
                      onValueChange={(value) =>
                        setDbConfig((prev) => ({ ...prev, database: value }))
                      }
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        {databaseOptions[dbConfig.dialect].map((db) => (
                          <SelectItem
                            key={db}
                            value={db}
                            className="text-white focus:bg-gray-600"
                          >
                            {db}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-180px)] rounded-lg border border-gray-700 bg-gray-800/50 backdrop-blur"
        >
          {/* Left Sidebar - Schema & Tools */}
          <ResizablePanel defaultSize={25} minSize={20}>
            <div className="h-full p-4">
              <Tabs defaultValue="schema" className="h-full">
                <TabsList className="grid w-full grid-cols-3 bg-gray-700">
                  <TabsTrigger
                    value="schema"
                    className="text-gray-300 data-[state=active]:text-white"
                  >
                    Schema
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="text-gray-300 data-[state=active]:text-white"
                  >
                    History
                  </TabsTrigger>
                  <TabsTrigger
                    value="upload"
                    className="text-gray-300 data-[state=active]:text-white"
                  >
                    Upload
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="schema"
                  className="mt-4 h-[calc(100%-60px)]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-300">
                        Database Schema
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDiscoverSchema}
                        disabled={isLoadingSchema}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                      >
                        {isLoadingSchema ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <SchemaPanel
                      schema={schema}
                      onTableSelect={(tableName) => {
                        setQuery(
                          (prev) =>
                            prev + `SELECT * FROM ${tableName} LIMIT 10;\\n`
                        );
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="history"
                  className="mt-4 h-[calc(100%-60px)]"
                >
                  <QueryHistory
                    queryHistory={queryHistoryData}
                    onSelectQuery={(selectedQuery) => setQuery(selectedQuery)}
                  />
                </TabsContent>

                <TabsContent
                  value="upload"
                  className="mt-4 h-[calc(100%-60px)]"
                >
                  <CsvUpload
                    dialect={dbConfig.dialect}
                    onUploadSuccess={() => {
                      // Refresh schema after upload
                      handleDiscoverSchema();
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-gray-600" />

          {/* Main Content - Editor & Results */}
          <ResizablePanel defaultSize={75} minSize={50}>
            <ResizablePanelGroup direction="vertical">
              {/* SQL Editor */}
              <ResizablePanel defaultSize={60} minSize={30}>
                <div className="h-full p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">
                      Query Editor
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={executeQuery}
                        disabled={isExecuting || !query.trim()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isExecuting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Execute Query
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <MonacoEditor
                    value={query}
                    onChange={setQuery}
                    dialect={dbConfig.dialect}
                    onExecute={executeQuery}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle className="bg-gray-600" />

              {/* Results Panel */}
              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="h-full p-4">
                  <ResultsPanel
                    result={queryResult}
                    error={queryError}
                    isExecuting={isExecuting}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
