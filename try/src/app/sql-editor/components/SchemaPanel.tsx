"use client";

import { useState } from "react";
import { ProjectMetadata } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Table,
  Columns,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Eye,
  Key,
  FolderTree,
} from "lucide-react";

interface SchemaPanelProps {
  project: ProjectMetadata | null;
  isLoading: boolean;
  onTableClick: (tableName: string) => void;
}

export function SchemaPanel({
  project,
  isLoading,
  onTableClick,
}: SchemaPanelProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(
    new Set(["mysql", "postgresql", "hive"])
  );
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    new Set()
  );

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const toggleCatalog = (catalogName: string) => {
    const newExpanded = new Set(expandedCatalogs);
    if (newExpanded.has(catalogName)) {
      newExpanded.delete(catalogName);
    } else {
      newExpanded.add(catalogName);
    }
    setExpandedCatalogs(newExpanded);
  };

  const toggleSchema = (schemaKey: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaKey)) {
      newExpanded.delete(schemaKey);
    } else {
      newExpanded.add(schemaKey);
    }
    setExpandedSchemas(newExpanded);
  };

  // Group tables by catalog and schema for Trino projects
  const groupTablesByCatalog = () => {
    if (!project?.schema?.tables) return {};

    const grouped: Record<string, Record<string, any[]>> = {};

    for (const table of project.schema.tables) {
      // Check if table has catalog/schema structure (Trino)
      if (table.catalog && table.schema) {
        if (!grouped[table.catalog]) {
          grouped[table.catalog] = {};
        }
        if (!grouped[table.catalog][table.schema]) {
          grouped[table.catalog][table.schema] = [];
        }
        grouped[table.catalog][table.schema].push(table);
      } else {
        // Non-Trino projects - group under default catalog
        const catalog = "default";
        const schema = project.database || "public";
        if (!grouped[catalog]) {
          grouped[catalog] = {};
        }
        if (!grouped[catalog][schema]) {
          grouped[catalog][schema] = [];
        }
        grouped[catalog][schema].push(table);
      }
    }

    return grouped;
  };

  const isTrinoProject = project?.dialect === "trino";
  const groupedTables = isTrinoProject ? groupTablesByCatalog() : null;

  const getColumnIcon = (column: any) => {
    if (column.key === "PRI" || column.key === "PRIMARY KEY") {
      return <Key className="h-3 w-3 text-yellow-500" />;
    }
    return <Columns className="h-3 w-3 text-gray-500" />;
  };

  const getColumnTypeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes("int") ||
      lowerType.includes("number") ||
      lowerType.includes("decimal")
    ) {
      return "text-blue-400";
    }
    if (
      lowerType.includes("varchar") ||
      lowerType.includes("text") ||
      lowerType.includes("char")
    ) {
      return "text-green-400";
    }
    if (lowerType.includes("date") || lowerType.includes("time")) {
      return "text-purple-400";
    }
    if (lowerType.includes("bool")) {
      return "text-orange-400";
    }
    return "text-gray-400";
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-400">Discovering schema...</p>
        </div>
      </div>
    );
  }

  if (
    !project ||
    !project.schema?.isDiscovered ||
    !project.schema?.tables?.length
  ) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Database className="h-12 w-12 mx-auto mb-3 text-gray-500" />
          <p className="text-sm text-gray-400 mb-2">No schema discovered</p>
          <p className="text-xs text-gray-500">
            Click "Refresh Schema" to discover tables
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">
              {project.database || project.dialect}
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-gray-600 text-gray-300 text-xs"
          >
            {project.schema.tables.length} tables
          </Badge>
        </div>
        {project.schema.lastSynced && (
          <p className="text-xs text-gray-500 mt-1">
            Last synced:{" "}
            {new Date(project.schema.lastSynced).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2">
          {/* Show hierarchical view for Trino with catalogs */}
          {isTrinoProject &&
          groupedTables &&
          Object.keys(groupedTables).length > 0
            ? Object.entries(groupedTables).map(([catalog, schemas]) => (
                <div key={catalog} className="mb-3">
                  {/* Catalog Level */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-start px-2 text-white hover:bg-gray-800 mb-1"
                    onClick={() => toggleCatalog(catalog)}
                  >
                    {expandedCatalogs.has(catalog) ? (
                      <ChevronDown className="h-3 w-3 mr-2" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mr-2" />
                    )}
                    <Database className="h-4 w-4 mr-2 text-blue-400" />
                    <span className="flex-1 text-left text-sm font-semibold">
                      {catalog}
                    </span>
                  </Button>

                  {/* Schema Level */}
                  {expandedCatalogs.has(catalog) &&
                    Object.entries(schemas).map(([schema, tables]) => (
                      <div key={`${catalog}.${schema}`} className="ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-full justify-start px-2 text-white hover:bg-gray-800 mb-1"
                          onClick={() => toggleSchema(`${catalog}.${schema}`)}
                        >
                          {expandedSchemas.has(`${catalog}.${schema}`) ? (
                            <ChevronDown className="h-3 w-3 mr-2" />
                          ) : (
                            <ChevronRight className="h-3 w-3 mr-2" />
                          )}
                          <FolderTree className="h-3 w-3 mr-2 text-yellow-400" />
                          <span className="flex-1 text-left text-xs">
                            {schema}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-gray-600 text-gray-400 text-xs"
                          >
                            {tables.length}
                          </Badge>
                        </Button>

                        {/* Tables in Schema */}
                        {expandedSchemas.has(`${catalog}.${schema}`) &&
                          tables.map((table: any) => (
                            <div key={table.name} className="ml-6 mb-2">
                              {/* Table Header */}
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-full justify-start px-2 text-white hover:bg-gray-800"
                                  onClick={() => toggleTable(table.name)}
                                >
                                  {expandedTables.has(table.name) ? (
                                    <ChevronDown className="h-3 w-3 mr-2" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 mr-2" />
                                  )}
                                  <Table className="h-4 w-4 mr-2 text-green-400" />
                                  <span className="flex-1 text-left text-xs">
                                    {(table as any).tableName || table.name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="border-gray-600 text-gray-400 text-xs ml-2"
                                  >
                                    {table.columns?.length || 0}
                                  </Badge>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
                                  onClick={() => onTableClick(table.name)}
                                  title="Insert SELECT query"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Table Columns */}
                              {expandedTables.has(table.name) &&
                                table.columns && (
                                  <div className="ml-6 mt-2 space-y-1">
                                    {table.columns.map((column: any) => (
                                      <div
                                        key={column.name}
                                        className="flex items-center space-x-2 px-2 py-1 rounded text-xs hover:bg-gray-800/50 cursor-pointer group"
                                        onClick={() =>
                                          onTableClick(
                                            `${table.name}.${column.name}`
                                          )
                                        }
                                        title={`Click to insert ${table.name}.${column.name}`}
                                      >
                                        {getColumnIcon(column)}
                                        <span className="text-gray-300 flex-1">
                                          {column.name}
                                        </span>
                                        <span
                                          className={`text-xs ${getColumnTypeColor(
                                            column.type
                                          )}`}
                                        >
                                          {column.type}
                                        </span>
                                        {!column.nullable && (
                                          <span className="text-red-400 text-xs">
                                            NOT NULL
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
              ))
            : /* Flat view for non-Trino projects */
              project.schema.tables.map((table) => (
                <div key={table.name} className="mb-2">
                  {/* Table Header */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-start px-2 text-white hover:bg-gray-800"
                      onClick={() => toggleTable(table.name)}
                    >
                      {expandedTables.has(table.name) ? (
                        <ChevronDown className="h-3 w-3 mr-2" />
                      ) : (
                        <ChevronRight className="h-3 w-3 mr-2" />
                      )}
                      <Table className="h-4 w-4 mr-2 text-green-400" />
                      <span className="flex-1 text-left text-sm">
                        {table.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-gray-600 text-gray-400 text-xs ml-2"
                      >
                        {table.columns?.length || 0}
                      </Badge>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
                      onClick={() => onTableClick(table.name)}
                      title="Insert SELECT query"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Table Columns */}
                  {expandedTables.has(table.name) && table.columns && (
                    <div className="ml-6 mt-2 space-y-1">
                      {table.columns.map((column) => (
                        <div
                          key={column.name}
                          className="flex items-center space-x-2 px-2 py-1 rounded text-xs hover:bg-gray-800/50 cursor-pointer group"
                          onClick={() =>
                            onTableClick(`${table.name}.${column.name}`)
                          }
                          title={`Click to insert ${table.name}.${column.name}`}
                        >
                          {getColumnIcon(column)}
                          <span className="text-gray-300 flex-1">
                            {column.name}
                          </span>
                          <span
                            className={`text-xs ${getColumnTypeColor(
                              column.type
                            )}`}
                          >
                            {column.type}
                          </span>
                          {!column.nullable && (
                            <span className="text-red-400 text-xs">
                              NOT NULL
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          Click table names to insert queries
        </div>
      </div>
    </div>
  );
}
