"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Activity,
  Table,
  TrendingUp,
  Zap,
  AlertCircle,
  Database,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface QueryPatternData {
  query_types: Array<{ type: string; count: number; avg_time: number }>;
  most_accessed_tables: Array<{
    table: string;
    accesses: number;
    avg_time: number;
    last_access: string;
  }>;
  complexity_distribution: Array<{
    level: string;
    count: number;
    avg_time: number;
  }>;
  performance: {
    total_queries: number;
    success_rate: number;
    avg_time: number;
    avg_joins: number;
    avg_complexity: number;
  };
}

export default function QueryPatternsAnalytics() {
  const router = useRouter();
  const { currentProject } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [patternData, setPatternData] = useState<QueryPatternData | null>(null);
  const [timeRange, setTimeRange] = useState<24 | 168 | 720>(24);

  useEffect(() => {
    if (!currentProject) {
      router.push("/projects");
      return;
    }
    fetchPatternData();
  }, [currentProject, timeRange]);

  const fetchPatternData = async () => {
    if (!currentProject?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/analytics/query-patterns?project_id=${currentProject.id}&hours=${timeRange}`
      );
      if (response.ok) {
        const data = await response.json();
        setPatternData(data);
      }
    } catch (error) {
      console.error("Failed to fetch query pattern analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading query patterns...</p>
        </div>
      </div>
    );
  }

  if (!patternData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-400">No query pattern data available</p>
        </div>
      </div>
    );
  }

  const { query_types, most_accessed_tables, complexity_distribution, performance } =
    patternData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
                <Activity className="h-8 w-8 text-blue-500" />
                <span>Query Pattern Analytics</span>
              </h1>
              <p className="text-gray-400 mt-1">
                {currentProject?.name} - SQL query insights
              </p>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex space-x-2">
            {[
              { label: "24 Hours", value: 24 },
              { label: "7 Days", value: 168 },
              { label: "30 Days", value: 720 },
            ].map((range) => (
              <Button
                key={range.value}
                size="sm"
                variant={timeRange === range.value ? "default" : "outline"}
                onClick={() => setTimeRange(range.value as 24 | 168 | 720)}
                className={
                  timeRange === range.value
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "border-gray-600 text-gray-300 hover:bg-gray-800"
                }
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Total Queries
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {performance.total_queries || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Last{" "}
                {timeRange === 24
                  ? "24 hours"
                  : timeRange === 168
                  ? "7 days"
                  : "30 days"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Success Rate
              </CardTitle>
              <Zap className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {performance.success_rate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Query success rate</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Avg Execution
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {performance.avg_time?.toFixed(0) || 0}ms
              </div>
              <p className="text-xs text-gray-500 mt-1">Average query time</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Avg Complexity
              </CardTitle>
              <Database className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {performance.avg_complexity?.toFixed(0) || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Complexity score</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="types" className="space-y-6">
          <TabsList className="bg-gray-800 border border-gray-700">
            <TabsTrigger value="types">Query Types</TabsTrigger>
            <TabsTrigger value="tables">Table Access</TabsTrigger>
            <TabsTrigger value="complexity">Complexity</TabsTrigger>
          </TabsList>

          {/* Query Types Tab */}
          <TabsContent value="types" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <span>Query Type Distribution</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={query_types}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.type}: ${entry.count}`}
                      >
                        {query_types.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span>Avg Execution Time by Type</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={query_types}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="type" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="avg_time" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Table Access Tab */}
          <TabsContent value="tables" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Table className="h-5 w-5 text-blue-500" />
                  <span>Most Accessed Tables</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {most_accessed_tables.map((table, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">
                            #{index + 1}
                          </Badge>
                          <span className="text-white font-semibold">
                            {table.table}
                          </span>
                        </div>
                        <div className="flex space-x-6 mt-2 text-sm text-gray-400">
                          <span>{table.accesses} accesses</span>
                          <span>Avg: {table.avg_time?.toFixed(0)}ms</span>
                          <span>
                            Last: {new Date(table.last_access).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {most_accessed_tables.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No table access data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Complexity Tab */}
          <TabsContent value="complexity" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Database className="h-5 w-5 text-yellow-500" />
                  <span>Query Complexity Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={complexity_distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="level" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" name="Query Count" />
                    <Bar dataKey="avg_time" fill="#f59e0b" name="Avg Time (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Average JOINs per Query</span>
                  <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">
                    {performance.avg_joins?.toFixed(2) || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Overall Complexity Score</span>
                  <Badge
                    className={
                      (performance.avg_complexity || 0) < 30
                        ? "bg-green-900/50 text-green-300 border-green-700"
                        : (performance.avg_complexity || 0) < 60
                        ? "bg-yellow-900/50 text-yellow-300 border-yellow-700"
                        : "bg-red-900/50 text-red-300 border-red-700"
                    }
                  >
                    {performance.avg_complexity?.toFixed(0) || 0} / 100
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
