"use client";

import { useState, useEffect } from "react";
import { ProjectMetadata, useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Database,
  Zap,
  Loader2,
} from "lucide-react";

interface QueryHistoryProps {
  project: ProjectMetadata;
  onQuerySelect: (query: string) => void;
}

export function QueryHistory({ project, onQuerySelect }: QueryHistoryProps) {
  const { getQueryIntents } = useProject();
  const [queryIntents, setQueryIntents] = useState<
    ProjectMetadata["queryIntents"]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load query intents from Redis
  useEffect(() => {
    const loadIntents = async () => {
      if (project?.id) {
        setIsLoading(true);
        try {
          const intents = await getQueryIntents(project.id, 50);
          setQueryIntents(intents || []);
        } catch (error) {
          console.error("Failed to load query intents:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadIntents();
  }, [project?.id, getQueryIntents]);

  const queryHistory = queryIntents;

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateQuery = (query: string, maxLength = 80) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + "...";
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 mx-auto mb-3 text-purple-400 animate-spin" />
          <p className="text-sm text-gray-400">Loading query history...</p>
        </div>
      </div>
    );
  }

  if (!queryHistory || queryHistory.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-500" />
          <p className="text-sm text-gray-400 mb-2">No queries yet</p>
          <p className="text-xs text-gray-500">
            Your query history will appear here
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
            <Clock className="h-5 w-5 text-purple-400" />
            <span className="text-white font-medium">Query History</span>
          </div>
          <Badge
            variant="outline"
            className="border-gray-600 text-gray-300 text-xs"
          >
            {queryHistory?.length || 0} queries
          </Badge>
        </div>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {queryHistory
            ?.slice()
            .reverse() // Show most recent first
            .map((item, index) => (
              <div
                key={item.id || index}
                className="group cursor-pointer"
                onClick={() => onQuerySelect(item.sqlQuery)}
              >
                <div className="p-3 rounded-lg border border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 transition-all">
                  {/* Query Status & Time */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {!item.wasSuccessful ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      )}
                      <span className="text-xs text-gray-400">
                        {formatTimestamp(item.executedAt)}
                      </span>
                    </div>

                    {item.executionTimeMs && (
                      <div className="flex items-center space-x-1">
                        <Zap className="h-3 w-3 text-yellow-400" />
                        <span className="text-xs text-gray-400">
                          {formatExecutionTime(item.executionTimeMs)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Query Text */}
                  <div className="mb-2">
                    <code className="text-sm text-gray-200 bg-gray-900 p-2 rounded block font-mono whitespace-pre-wrap">
                      {truncateQuery(item.sqlQuery)}
                    </code>
                  </div>

                  {/* Query Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-2">
                      {item.tablesReferenced &&
                        item.tablesReferenced.length > 0 && (
                          <>
                            <Database className="h-3 w-3" />
                            <span>{item.tablesReferenced.join(", ")}</span>
                          </>
                        )}
                      {item.userQuestion && (
                        <span
                          className="truncate max-w-32 italic"
                          title={item.userQuestion}
                        >
                          &ldquo;{item.userQuestion}&rdquo;
                        </span>
                      )}
                      {item.errorMessage && (
                        <span
                          className="text-red-400 truncate max-w-48"
                          title={item.errorMessage}
                        >
                          {item.errorMessage}
                        </span>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuerySelect(item.sqlQuery);
                      }}
                      title="Load query in editor"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          Click queries to load in editor
        </div>
      </div>
    </div>
  );
}
