"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Database,
  Play,
  History,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { MonacoEditor } from "./components/MonacoEditor";
import { SchemaPanel } from "./components/SchemaPanel";
import { QueryHistory } from "./components/QueryHistory";
import { ResultsPanel } from "./components/ResultsPanel";
import { CsvUpload } from "./components/CsvUpload";
import { FederatedQueryTemplates } from "./components/FederatedQueryTemplates";

interface QueryResult {
  columns: string[];
  results: Record<string, unknown>[];
  executionTime: number;
  rowCount: number;
}

export default function SQLEditor() {
  const router = useRouter();
  const { currentProject, discoverSchema } = useProject();

  const [query, setQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Load pending query from AI Assistant if exists
  useEffect(() => {
    const pendingQuery = localStorage.getItem("pendingQuery");
    if (pendingQuery) {
      setQuery(pendingQuery);
      localStorage.removeItem("pendingQuery"); // Clear after loading
    }
  }, []);

  // Redirect if no current project
  useEffect(() => {
    if (!currentProject) {
      router.push("/projects");
      return;
    }

    // Discover schema if not already done
    const initializeEditor = async () => {
      if (!currentProject.schema?.isDiscovered) {
        setIsLoadingSchema(true);
        try {
          await discoverSchema(currentProject.id);
        } catch (error) {
          console.error("Failed to discover schema:", error);
        } finally {
          setIsLoadingSchema(false);
        }
      }
    };

    initializeEditor();
  }, [currentProject, discoverSchema, router]);

  const executeQuery = async () => {
    if (!query.trim() || !currentProject) return;

    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    const startTime = Date.now();

    try {
      const endpoint = getExecutionEndpoint(currentProject.dialect);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          projectId: currentProject.id, // Auto-tracks query intent in Redis
        }),
      });

      const result = await response.json();
      const executionTime = (Date.now() - startTime) / 1000;

      if (response.ok) {
        // Check if this is a DDL/DML success response
        if (result.success && result.message) {
          // DDL/DML query (CREATE, INSERT, UPDATE, DELETE)
          const queryResult = {
            success: true,
            message: result.message,
            affectedRows: result.affected_rows || 0,
            executionTime: result.execution_time || executionTime,
            queryType: result.query_type || "Query",
            columns: [],
            results: [],
            rowCount: 0,
          };
          setQueryResult(queryResult);

          // Auto-refresh schema if DDL query (backend invalidates cache automatically)
          const queryUpper = query.trim().toUpperCase();
          const isDDL =
            queryUpper.startsWith("CREATE ") ||
            queryUpper.startsWith("ALTER ") ||
            queryUpper.startsWith("DROP ") ||
            queryUpper.startsWith("RENAME ") ||
            queryUpper.startsWith("TRUNCATE ");
          if (isDDL) {
            console.log("🔄 DDL query detected, refreshing schema...");
            setTimeout(() => handleSchemaRefresh(), 500); // Small delay for DB consistency
          }
        } else {
          // SELECT query with results
          const queryResult = {
            columns: result.columns || [],
            results: result.results || [],
            executionTime: result.execution_time || executionTime,
            rowCount: result.row_count || result.results?.length || 0,
          };
          setQueryResult(queryResult);
        }
        // Query intent automatically saved to Redis by backend!
      } else {
        setQueryError(result.error || "Query execution failed");
        // Error intent also automatically saved to Redis
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Network error";
      setQueryError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  const getExecutionEndpoint = (dialect: string) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

    // Analytics projects: use actual engine
    if (dialect === "analytics") {
      const engine = currentProject?.actualEngine || "trino";
      return `${baseUrl}/execute/${engine}`;
    }

    // Traditional databases
    return `${baseUrl}/execute/${
      dialect === "postgresql" ? "postgresql" : dialect
    }`;
  };

  const handleSchemaRefresh = async () => {
    if (!currentProject) return;

    setIsLoadingSchema(true);
    try {
      await discoverSchema(currentProject.id);
    } catch (error) {
      console.error("Failed to refresh schema:", error);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {currentProject.name}
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge
                    variant="outline"
                    className="border-gray-600 text-gray-300"
                  >
                    {currentProject.dialect === "analytics" ? (
                      <span>
                        ANALYTICS
                        {currentProject.actualEngine && (
                          <span className="text-xs ml-1 opacity-75">
                            ({currentProject.actualEngine.toUpperCase()})
                          </span>
                        )}
                      </span>
                    ) : (
                      currentProject.dialect.toUpperCase()
                    )}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-gray-600 text-gray-300"
                  >
                    {currentProject.database}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <FederatedQueryTemplates
                projectDialect={currentProject.dialect}
                onTemplateSelect={(templateQuery) => {
                  setQuery(templateQuery);
                }}
              />

              <Button
                onClick={handleSchemaRefresh}
                disabled={isLoadingSchema}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                {isLoadingSchema ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Schema
              </Button>

              <Button
                onClick={executeQuery}
                disabled={!query.trim() || isExecuting}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isExecuting ? "Executing..." : "Execute"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Editor Layout */}
      <div className="h-[calc(100vh-80px)]">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Sidebar - Schema & History */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <div className="h-full bg-gray-900/50 border-r border-gray-800">
              <Tabs defaultValue="schema" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800 border-b border-gray-700">
                  <TabsTrigger
                    value="schema"
                    className="data-[state=active]:bg-gray-700"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Schema
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="data-[state=active]:bg-gray-700"
                  >
                    <History className="h-4 w-4 mr-2" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="schema"
                  className="flex-1 p-0 m-0 flex flex-col"
                >
                  <CsvUpload
                    onUploadComplete={async (
                      tableName,
                      columns,
                      schemaInvalidated
                    ) => {
                      // Auto-refresh schema if backend invalidated the cache
                      if (schemaInvalidated) {
                        console.log(
                          "🔄 Schema invalidated by CSV upload, refreshing..."
                        );
                        await handleSchemaRefresh();
                      }
                    }}
                  />
                  <div className="flex-1">
                    <SchemaPanel
                      project={currentProject}
                      isLoading={isLoadingSchema}
                      onTableClick={(tableName) => {
                        const currentQuery = query || "";
                        setQuery(
                          currentQuery +
                            (currentQuery ? "\n" : "") +
                            `SELECT * FROM ${tableName} LIMIT 10;`
                        );
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 p-0 m-0">
                  <QueryHistory
                    project={currentProject}
                    onQuerySelect={(selectedQuery) => setQuery(selectedQuery)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Main Editor Area */}
          <ResizablePanel defaultSize={75}>
            <ResizablePanelGroup direction="vertical">
              {/* Query Editor */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full bg-gray-900/50">
                  <div className="h-full border border-gray-800 rounded-lg m-2">
                    <MonacoEditor
                      value={query}
                      onChange={setQuery}
                      dialect={currentProject.dialect}
                      schema={currentProject.schema}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle />

              {/* Results Panel */}
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full bg-gray-900/50">
                  <ResultsPanel
                    queryResult={queryResult}
                    error={queryError}
                    loading={isExecuting}
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
