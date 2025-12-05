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
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Database,
  Zap,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface QueryIntent {
  id: string;
  sqlQuery: string;
  userQuestion?: string;
  executedAt: string;
  wasSuccessful: boolean;
  executionTimeMs: number;
}

export default function Analytics() {
  const router = useRouter();
  const { currentProject, getQueryIntents } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [queries, setQueries] = useState<QueryIntent[]>([]);
  const [stats, setStats] = useState({
    totalQueries: 0,
    successRate: 0,
    avgExecutionTime: 0,
    slowestQuery: 0,
    fastestQuery: 0,
  });

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

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentProject?.id) return;

      try {
        const queryData = await getQueryIntents(currentProject.id, 100);
        if (queryData && queryData.length > 0) {
          setQueries(queryData);
          calculateStats(queryData);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      }
    };

    if (currentProject?.id) {
      fetchAnalytics();
    }
  }, [currentProject?.id, getQueryIntents]);

  const calculateStats = (queryData: QueryIntent[]) => {
    const successful = queryData.filter((q) => q.wasSuccessful).length;
    const executionTimes = queryData.map((q) => q.executionTimeMs);

    setStats({
      totalQueries: queryData.length,
      successRate: (successful / queryData.length) * 100,
      avgExecutionTime:
        executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
      slowestQuery: Math.max(...executionTimes),
      fastestQuery: Math.min(...executionTimes),
    });
  };

  // Prepare chart data
  const getExecutionTimeData = () => {
    return queries
      .slice(0, 20)
      .reverse()
      .map((q, idx) => ({
        name: `Q${idx + 1}`,
        time: q.executionTimeMs,
        success: q.wasSuccessful ? 1 : 0,
      }));
  };

  const getSuccessRateData = () => {
    const successful = queries.filter((q) => q.wasSuccessful).length;
    const failed = queries.length - successful;
    return [
      { name: "Success", value: successful, color: "#10b981" },
      { name: "Failed", value: failed, color: "#ef4444" },
    ];
  };

  const getTimeDistribution = () => {
    const ranges = [
      { name: "< 100ms", min: 0, max: 100, count: 0 },
      { name: "100-500ms", min: 100, max: 500, count: 0 },
      { name: "500ms-1s", min: 500, max: 1000, count: 0 },
      { name: "1s-5s", min: 1000, max: 5000, count: 0 },
      { name: "> 5s", min: 5000, max: Infinity, count: 0 },
    ];

    queries.forEach((q) => {
      const range = ranges.find(
        (r) => q.executionTimeMs >= r.min && q.executionTimeMs < r.max
      );
      if (range) range.count++;
    });

    return ranges.map((r) => ({ name: r.name, queries: r.count }));
  };

  const getSlowestQueries = () => {
    return [...queries]
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
      .slice(0, 10);
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
                  <BarChart3 className="h-6 w-6 text-green-500" />
                  Query Analytics
                </h1>
                <p className="text-sm text-gray-400">
                  {currentProject.name} • Performance Insights
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs font-medium">
                    Total Queries
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats.totalQueries}
                  </p>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs font-medium">
                    Success Rate
                  </p>
                  <p className="text-2xl font-bold text-green-400 mt-1">
                    {stats.successRate.toFixed(1)}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs font-medium">Avg Time</p>
                  <p className="text-2xl font-bold text-yellow-400 mt-1">
                    {stats.avgExecutionTime.toFixed(0)}ms
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs font-medium">
                    Fastest Query
                  </p>
                  <p className="text-2xl font-bold text-green-400 mt-1">
                    {stats.fastestQuery.toFixed(0)}ms
                  </p>
                </div>
                <Zap className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs font-medium">
                    Slowest Query
                  </p>
                  <p className="text-2xl font-bold text-red-400 mt-1">
                    {stats.slowestQuery.toFixed(0)}ms
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="bg-gray-900 border border-gray-800">
            <TabsTrigger value="performance">Performance Trends</TabsTrigger>
            <TabsTrigger value="distribution">Time Distribution</TabsTrigger>
            <TabsTrigger value="success">Success Rate</TabsTrigger>
            <TabsTrigger value="slowest">Slowest Queries</TabsTrigger>
          </TabsList>

          {/* Performance Trends */}
          <TabsContent value="performance">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Query Execution Time (Last 20 Queries)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={getExecutionTimeData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="time"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", r: 4 }}
                      name="Execution Time (ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Distribution */}
          <TabsContent value="distribution">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  Query Time Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={getTimeDistribution()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" label={{ value: 'Number of Queries', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="queries" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Success Rate */}
          <TabsContent value="success">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Success vs Failed Queries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getSuccessRateData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getSuccessRateData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Query Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                    <span className="text-gray-400">Total Queries</span>
                    <span className="text-white font-bold">
                      {stats.totalQueries}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <span className="text-green-400">Successful</span>
                    <span className="text-green-400 font-bold">
                      {getSuccessRateData()[0].value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <span className="text-red-400">Failed</span>
                    <span className="text-red-400 font-bold">
                      {getSuccessRateData()[1].value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                    <span className="text-gray-400">Success Rate</span>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {stats.successRate.toFixed(1)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Slowest Queries */}
          <TabsContent value="slowest">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Top 10 Slowest Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getSlowestQueries().map((query, idx) => (
                    <div
                      key={query.id}
                      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${
                              query.executionTimeMs > 1000
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : query.executionTimeMs > 500
                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                : "bg-green-500/20 text-green-400 border-green-500/30"
                            }`}
                          >
                            #{idx + 1}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            {new Date(query.executedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span className="text-yellow-400 font-bold">
                            {query.executionTimeMs.toFixed(0)}ms
                          </span>
                        </div>
                      </div>
                      {query.userQuestion && (
                        <p className="text-sm text-blue-400 mb-2">
                          Q: {query.userQuestion}
                        </p>
                      )}
                      <pre className="text-xs text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto">
                        {query.sqlQuery}
                      </pre>
                    </div>
                  ))}
                  {queries.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                      <p className="text-lg">No query data available yet</p>
                      <p className="text-sm mt-2">
                        Execute some queries to see analytics
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
