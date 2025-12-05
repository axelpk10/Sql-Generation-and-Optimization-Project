"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Database,
  RefreshCw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Download,
  Table2,
} from "lucide-react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

interface Column {
  name: string;
  type: string;
}

interface Table {
  name: string;
  columns: string | Column[];
}

interface SchemaData {
  tables: Table[];
}

export default function SchemaVisualizer() {
  const router = useRouter();
  const { currentProject } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Route Protection
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentProject) {
        router.push("/projects");
        return;
      }
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [currentProject, router]);

  // Fetch schema
  useEffect(() => {
    const fetchSchema = async () => {
      if (!currentProject?.id) return;

      try {
        const response = await fetch(
          `http://localhost:8000/api/projects/${currentProject.id}/schema`
        );
        if (response.ok) {
          const data = await response.json();
          setSchema(data.schema);
          generateDiagram(data.schema);
        }
      } catch (error) {
        console.error("Failed to fetch schema:", error);
      }
    };

    if (currentProject?.id) {
      fetchSchema();
    }
  }, [currentProject?.id]);

  const parseColumns = (table: Table): Column[] => {
    if (typeof table.columns === "string") {
      // Parse string format: "col1 (type1), col2 (type2)"
      return table.columns.split(",").map((col) => {
        const match = col.trim().match(/(.+?)\s*\((.+?)\)/);
        if (match) {
          return { name: match[1].trim(), type: match[2].trim() };
        }
        return { name: col.trim(), type: "unknown" };
      });
    }
    return table.columns as Column[];
  };

  const detectRelationships = (tables: Table[]): Edge[] => {
    const relationships: Edge[] = [];
    const tableNames = tables.map((t) => t.name.toLowerCase());

    tables.forEach((table, tableIndex) => {
      const columns = parseColumns(table);

      columns.forEach((column) => {
        const colName = column.name.toLowerCase();

        // Detect foreign key patterns: user_id, customer_id, order_id, etc.
        if (colName.endsWith("_id") || colName.endsWith("id")) {
          const potentialTable = colName.replace(/_id$|id$/, "");

          // Look for matching table (singular or plural)
          const matchingTable = tables.find((t) => {
            const tName = t.name.toLowerCase();
            return (
              tName === potentialTable ||
              tName === potentialTable + "s" ||
              tName + "s" === potentialTable ||
              tName.replace(/s$/, "") === potentialTable
            );
          });

          if (matchingTable && matchingTable.name !== table.name) {
            relationships.push({
              id: `${table.name}-${matchingTable.name}-${column.name}`,
              source: matchingTable.name,
              target: table.name,
              type: "smoothstep",
              animated: true,
              label: column.name,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#6366f1",
              },
              style: { stroke: "#6366f1", strokeWidth: 2 },
            });
          }
        }
      });
    });

    return relationships;
  };

  const generateDiagram = (schemaData: SchemaData) => {
    if (!schemaData?.tables || schemaData.tables.length === 0) return;

    const tables = schemaData.tables;
    const gridColumns = Math.ceil(Math.sqrt(tables.length));
    const spacing = { x: 350, y: 300 };

    // Generate nodes
    const generatedNodes: Node[] = tables.map((table, index) => {
      const row = Math.floor(index / gridColumns);
      const col = index % gridColumns;
      const columns = parseColumns(table);

      return {
        id: table.name,
        type: "default",
        position: {
          x: col * spacing.x + 50,
          y: row * spacing.y + 50,
        },
        data: {
          label: (
            <div
              className="px-4 py-3 bg-gray-900 border-2 border-blue-500 rounded-lg shadow-lg min-w-[280px] cursor-pointer hover:border-purple-500 transition-colors"
              onClick={() => setSelectedTable(table)}
            >
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
                <Table2 className="h-4 w-4 text-blue-400" />
                <span className="font-bold text-white text-sm">
                  {table.name}
                </span>
              </div>
              <div className="space-y-1 text-xs max-h-[120px] overflow-y-auto">
                {columns.slice(0, 5).map((col, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-gray-300"
                  >
                    <span className="font-mono">{col.name}</span>
                    <span className="text-gray-500 ml-2">{col.type}</span>
                  </div>
                ))}
                {columns.length > 5 && (
                  <div className="text-gray-500 italic">
                    +{columns.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          ),
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    // Detect relationships
    const generatedEdges = detectRelationships(tables);

    setNodes(generatedNodes);
    setEdges(generatedEdges);
  };

  const handleRefreshSchema = async () => {
    if (!currentProject?.id) return;

    try {
      const response = await fetch(
        `http://localhost:8000/api/projects/${currentProject.id}/schema/discover`,
        { method: "POST" }
      );

      if (response.ok) {
        const data = await response.json();
        setSchema(data.schema);
        generateDiagram(data.schema);
      }
    } catch (error) {
      console.error("Failed to refresh schema:", error);
    }
  };

  const exportDiagram = () => {
    // Simple SVG export functionality
    const svg = document.querySelector(".react-flow__viewport");
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(
        svg as unknown as Node
      );
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentProject?.name}-schema.svg`;
      link.click();
    }
  };

  if (isLoading || !currentProject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Database className="h-6 w-6 text-blue-500" />
                  Schema Visualizer
                </h1>
                <p className="text-sm text-gray-400">
                  {currentProject.name} • {currentProject.dialect.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleRefreshSchema}
                variant="outline"
                className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Schema
              </Button>
              <Button
                onClick={exportDiagram}
                variant="outline"
                className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export SVG
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Diagram */}
          <div className="lg:col-span-3">
            <Card className="bg-gray-900 border-gray-800 h-[calc(100vh-180px)]">
              <CardContent className="p-0 h-full">
                {schema && schema.tables && schema.tables.length > 0 ? (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    className="bg-gray-950"
                  >
                    <Background color="#374151" gap={16} />
                    <Controls className="bg-gray-800 border border-gray-700" />
                  </ReactFlow>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <Database className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                      <p className="text-lg font-medium">No Schema Available</p>
                      <p className="text-sm mt-2">
                        Click "Refresh Schema" to discover your database structure
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Table Details Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-900 border-gray-800 h-[calc(100vh-180px)] flex flex-col">
              <CardHeader className="shrink-0">
                <CardTitle className="text-white flex items-center gap-2">
                  <Table2 className="h-5 w-5 text-blue-500" />
                  {selectedTable ? selectedTable.name : "Table Details"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {selectedTable ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">
                        Columns ({parseColumns(selectedTable).length})
                      </h3>
                      <div className="space-y-2">
                        {parseColumns(selectedTable).map((col, idx) => (
                          <div
                            key={idx}
                            className="bg-gray-800 rounded p-2 text-sm"
                          >
                            <div className="font-mono text-white">
                              {col.name}
                            </div>
                            <div className="text-gray-500 text-xs mt-1">
                              {col.type}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Relationships */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">
                        Relationships
                      </h3>
                      <div className="space-y-1">
                        {edges
                          .filter(
                            (e) =>
                              e.source === selectedTable.name ||
                              e.target === selectedTable.name
                          )
                          .map((edge) => (
                            <div
                              key={edge.id}
                              className="text-xs bg-gray-800 rounded p-2"
                            >
                              <span className="text-blue-400">
                                {edge.source}
                              </span>
                              <span className="text-gray-500 mx-1">→</span>
                              <span className="text-purple-400">
                                {edge.target}
                              </span>
                              {edge.label && (
                                <div className="text-gray-500 mt-1">
                                  via {edge.label}
                                </div>
                              )}
                            </div>
                          ))}
                        {edges.filter(
                          (e) =>
                            e.source === selectedTable.name ||
                            e.target === selectedTable.name
                        ).length === 0 && (
                          <p className="text-gray-500 text-xs">
                            No relationships detected
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Table2 className="h-12 w-12 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm">
                      Click on a table to view its details
                    </p>
                  </div>
                )}
              </CardContent>
              
              {/* Stats Footer - Compact */}
              {selectedTable && (
                <div className="border-t border-gray-800 p-3 shrink-0 bg-gray-900/50">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Tables:</span>
                      <span className="text-white font-medium">
                        {schema?.tables?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Relationships:</span>
                      <span className="text-white font-medium">{edges.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Database:</span>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                        {currentProject.dialect.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
