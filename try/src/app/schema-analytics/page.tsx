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
  Database,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  BarChart3,
  Activity,
  Layers,
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

interface SchemaAnalyticsData {
  period_hours: number;
  overall: {
    total_schemas: number;
    avg_response_time: number;
    avg_complexity: number;
    avg_columns: number;
    avg_constraints: number;
    avg_indexes: number;
    success_rate: number;
    fk_usage_rate: number;
  };
  quality: {
    avg_quality_score: number;
    avg_normalization: number;
    avg_constraint_coverage: number;
    avg_indexing_quality: number;
  };
  by_category: Array<{
    category: string;
    count: number;
    avg_response_time: number;
    avg_complexity: number;
  }>;
  complexity_distribution: Array<{
    level: string;
    count: number;
    avg_response_time: number;
  }>;
}

export default function SchemaAnalytics() {
  const router = useRouter();
  const { currentProject } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<SchemaAnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<24 | 168 | 720>(24); // 24h, 7d, 30d

  useEffect(() => {
    if (!currentProject) {
      router.push("/projects");
      return;
    }
    fetchAnalytics();
  }, [currentProject, timeRange]);

  const fetchAnalytics = async () => {
    if (!currentProject?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5001/analytics?hours=${timeRange}&project_id=${currentProject.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error("Failed to fetch schema analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = {
    primary: "#3b82f6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    pink: "#ec4899",
  };

  const PIE_COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading schema analytics...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-400">No analytics data available</p>
        </div>
      </div>
    );
  }

  const { overall, quality, by_category, complexity_distribution } = analyticsData;

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
                <Database className="h-8 w-8 text-blue-500" />
                <span>Schema Generation Analytics</span>
              </h1>
              <p className="text-gray-400 mt-1">
                Performance metrics and quality insights
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
                Total Schemas
              </CardTitle>
              <Database className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {overall.total_schemas || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Last {timeRange === 24 ? "24 hours" : timeRange === 168 ? "7 days" : "30 days"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Avg Response Time
              </CardTitle>
              <Clock className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {overall.avg_response_time?.toFixed(2) || 0}s
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Schema generation speed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Success Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {overall.success_rate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Successful generations
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Quality Score
              </CardTitle>
              <Award className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {quality.avg_quality_score?.toFixed(1) || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Out of 100
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="complexity" className="space-y-6">
          <TabsList className="bg-gray-800 border border-gray-700">
            <TabsTrigger value="complexity">Complexity</TabsTrigger>
            <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="details">Detailed Stats</TabsTrigger>
          </TabsList>

          {/* Complexity Tab */}
          <TabsContent value="complexity" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Complexity Distribution */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Layers className="h-5 w-5 text-blue-500" />
                    <span>Schema Complexity Distribution</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={complexity_distribution}
                        dataKey="count"
                        nameKey="level"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {complexity_distribution.map((entry, index) => (
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
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Complexity Metrics */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    <span>Average Complexity Metrics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        {
                          name: "Tables",
                          value: overall.avg_complexity || 0,
                        },
                        {
                          name: "Columns",
                          value: overall.avg_columns || 0,
                        },
                        {
                          name: "Constraints",
                          value: overall.avg_constraints || 0,
                        },
                        {
                          name: "Indexes",
                          value: overall.avg_indexes || 0,
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" fill={COLORS.primary} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <span>Quality Score Breakdown</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={[
                      {
                        metric: "Overall",
                        score: quality.avg_quality_score || 0,
                      },
                      {
                        metric: "Normalization",
                        score: quality.avg_normalization || 0,
                      },
                      {
                        metric: "Constraints",
                        score: quality.avg_constraint_coverage || 0,
                      },
                      {
                        metric: "Indexing",
                        score: quality.avg_indexing_quality || 0,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="metric" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="score" fill={COLORS.success}>
                      {[0, 1, 2, 3].map((index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span>Schemas by Category</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {by_category.map((category, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Badge
                            className="bg-blue-900/50 text-blue-300 border-blue-700"
                          >
                            {category.category || "Uncategorized"}
                          </Badge>
                          <span className="text-white font-semibold">
                            {category.count} schemas
                          </span>
                        </div>
                        <div className="flex space-x-6 mt-2 text-sm text-gray-400">
                          <span>
                            Avg Time: {category.avg_response_time?.toFixed(2)}s
                          </span>
                          <span>
                            Avg Complexity: {category.avg_complexity?.toFixed(1)}{" "}
                            tables
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {by_category.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No category data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Stats Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Schema Features Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Foreign Keys Used</span>
                    <Badge className="bg-green-900/50 text-green-300 border-green-700">
                      {overall.fk_usage_rate?.toFixed(1) || 0}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Tables per Schema</span>
                    <span className="text-white font-semibold">
                      {overall.avg_complexity?.toFixed(1) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Columns per Schema</span>
                    <span className="text-white font-semibold">
                      {overall.avg_columns?.toFixed(1) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">
                      Avg Constraints per Schema
                    </span>
                    <span className="text-white font-semibold">
                      {overall.avg_constraints?.toFixed(1) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Indexes per Schema</span>
                    <span className="text-white font-semibold">
                      {overall.avg_indexes?.toFixed(1) || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Performance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Schemas Generated</span>
                    <span className="text-white font-semibold text-xl">
                      {overall.total_schemas || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Success Rate</span>
                    <Badge
                      className={
                        (overall.success_rate || 0) > 90
                          ? "bg-green-900/50 text-green-300 border-green-700"
                          : "bg-yellow-900/50 text-yellow-300 border-yellow-700"
                      }
                    >
                      {overall.success_rate?.toFixed(1) || 0}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Generation Time</span>
                    <Badge
                      className={
                        (overall.avg_response_time || 0) < 5
                          ? "bg-green-900/50 text-green-300 border-green-700"
                          : "bg-yellow-900/50 text-yellow-300 border-yellow-700"
                      }
                    >
                      {overall.avg_response_time?.toFixed(2) || 0}s
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Overall Quality Score</span>
                    <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">
                      {quality.avg_quality_score?.toFixed(1) || 0} / 100
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
