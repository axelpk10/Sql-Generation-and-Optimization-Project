"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Zap,
  Copy,
  FileText,
} from "lucide-react";

interface QueryResult {
  success?: boolean;
  message?: string;
  affectedRows?: number;
  queryType?: string;
  columns?: string[];
  results?: Record<string, unknown>[];
  executionTime?: number;
  rowCount?: number;
}

interface ResultsPanelProps {
  queryResult: QueryResult | null;
  error: string | null;
  loading: boolean;
}

export function ResultsPanel({
  queryResult,
  error,
  loading,
}: ResultsPanelProps) {
  const results = queryResult?.results || [];
  const executionTime = queryResult?.executionTime;
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const formatExecutionTime = (time: number) => {
    if (time < 1) {
      return `${(time * 1000).toFixed(0)}ms`;
    }
    return `${time.toFixed(2)}s`;
  };

  const exportToCSV = () => {
    if (!results || results.length === 0) return;

    const headers = Object.keys(results[0]);
    const csvContent = [
      headers.join(","),
      ...results.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Handle quotes and commas in values
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `query_results_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async () => {
    if (!results || results.length === 0) return;

    const headers = Object.keys(results[0]);
    const text = [
      headers.join("\t"),
      ...results.map((row) => headers.map((header) => row[header]).join("\t")),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <Clock className="h-8 w-8 mx-auto mb-3 text-purple-400 animate-spin" />
          <p className="text-sm text-gray-300">Executing query...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col">
        {/* Error Header */}
        <div className="p-4 border-b border-red-800 bg-red-900/20">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-red-300 font-medium">Query Error</span>
          </div>
        </div>

        {/* Error Content */}
        <div className="flex-1 p-4">
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-4">
            <pre className="text-red-200 text-sm whitespace-pre-wrap font-mono">
              {error}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Success state for DDL/DML queries (CREATE, INSERT, UPDATE, DELETE)
  if (queryResult?.success && queryResult?.message) {
    return (
      <div className="h-full flex flex-col">
        {/* Success Header */}
        <div className="p-4 border-b border-green-800 bg-green-900/20">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-green-300 font-medium">
              Query Executed Successfully
            </span>
          </div>
        </div>

        {/* Success Content */}
        <div className="flex-1 p-4">
          <div className="bg-green-950/50 border border-green-800 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-green-400" />
                <span className="text-green-200 text-lg font-medium">
                  {queryResult.message}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                {queryResult.queryType && (
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Query Type</div>
                    <div className="text-sm text-white font-medium">
                      {queryResult.queryType}
                    </div>
                  </div>
                )}

                {queryResult.affectedRows !== undefined && (
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">
                      Affected Rows
                    </div>
                    <div className="text-sm text-white font-medium">
                      {queryResult.affectedRows}
                    </div>
                  </div>
                )}

                {queryResult.executionTime !== undefined && (
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">
                      Execution Time
                    </div>
                    <div className="text-sm text-white font-medium flex items-center space-x-1">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      <span>
                        {formatExecutionTime(queryResult.executionTime)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-200">
                    Your query has been executed successfully. For CREATE or
                    ALTER queries, use the &quot;Refresh Schema&quot; button in
                    the Schema panel to see the updated structure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No results state
  if (!results || results.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-white">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-500" />
          <p className="text-sm text-gray-400 mb-2">No results</p>
          <p className="text-xs text-gray-500">
            Execute a query to see results here
          </p>
        </div>
      </div>
    );
  }

  const columns = Object.keys(results[0]);

  return (
    <div className="h-full flex flex-col">
      {/* Results Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span className="text-white font-medium">Query Results</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Database className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-gray-300">
                  {results.length} rows
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <Badge
                  variant="outline"
                  className="border-gray-600 text-gray-300 text-xs"
                >
                  {columns.length} columns
                </Badge>
              </div>

              {executionTime && (
                <div className="flex items-center space-x-1">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">
                    {formatExecutionTime(executionTime)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              title="Copy to clipboard"
            >
              <Copy className="h-4 w-4 mr-1" />
              {copiedToClipboard ? "Copied!" : "Copy"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              title="Export as CSV"
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
          <TableHeader className="sticky top-0 bg-gray-800 z-10">
            <TableRow className="border-gray-700 hover:bg-gray-800">
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  className="text-gray-300 font-medium border-r border-gray-700 last:border-r-0 px-4 py-3"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className="border-gray-700 hover:bg-gray-800/50"
              >
                {columns.map((column, columnIndex) => (
                  <TableCell
                    key={columnIndex}
                    className="text-gray-200 border-r border-gray-700 last:border-r-0 px-4 py-3 font-mono text-sm max-w-xs"
                  >
                    <div className="truncate" title={String(row[column])}>
                      {row[column] === null || row[column] === undefined ? (
                        <span className="text-gray-500 italic">null</span>
                      ) : (
                        String(row[column])
                      )}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Results Footer */}
      <div className="p-3 border-t border-gray-700 bg-gray-800/30">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {results.length} rows × {columns.length} columns
          </span>
          {executionTime && (
            <span>Executed in {formatExecutionTime(executionTime)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
