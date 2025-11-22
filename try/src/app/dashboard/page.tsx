"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProject } from "@/contexts/ProjectContext";
import {
  Database,
  MessageSquare,
  BarChart3,
  Zap,
  FileText,
  Clock,
  TrendingUp,
  ChevronRight,
  Activity,
  Settings,
  Plus,
  ChevronDown,
  Brain,
} from "lucide-react";

// Dashboard content wrapped with project context
function DashboardContent() {
  const router = useRouter();
  const {
    currentProject,
    projects,
    setCurrentProject,
    clearAllContext,
    getQueryIntents,
    getProjectStats,
  } = useProject();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [queryCount, setQueryCount] = useState(0);
  const [schemaCount, setSchemaCount] = useState(0);
  const [recentQueries, setRecentQueries] = useState<
    Array<{
      id: string;
      sqlQuery: string;
      userQuestion?: string;
      executedAt: string;
      wasSuccessful: boolean;
      executionTimeMs: number;
    }>
  >([]);

  // Load project stats
  useEffect(() => {
    const loadStats = async () => {
      if (currentProject?.id) {
        try {
          const stats = await getProjectStats(currentProject.id);
          setQueryCount(stats.totalQueryIntents || 0);
          setSchemaCount(stats.schema?.tables?.length || 0);

          const intents = await getQueryIntents(currentProject.id, 3);
          setRecentQueries(intents || []);
        } catch (error) {
          console.error("Failed to load project stats:", error);
        }
      }
    };
    loadStats();
  }, [currentProject?.id, getProjectStats, getQueryIntents]);

  // Route Protection: Redirect to projects if no current project
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

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/auth/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Show loading while checking project context
  if (isLoading || !currentProject) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="text-white text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Original dashboard with project context
  const features = [
    {
      icon: <Database className="h-8 w-8" />,
      title: "SQL Editor",
      description:
        "Interactive SQL editor with schema discovery and query execution",
      status: "Active",
      color: "from-blue-500 to-purple-500",
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: "AI Assistant",
      description:
        "Generate optimized SQL queries and database schemas using AI",
      status: "Active",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: <Activity className="h-8 w-8" />,
      title: "Health Check",
      description: "Monitor backend services and system health status",
      status: "Active",
      color: "from-emerald-500 to-teal-500",
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Query Analytics",
      description: "Analyze query performance and optimization opportunities",
      status: "Coming Soon",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Schema Generator",
      description: "AI-powered database schema generation and visualization",
      status: "Coming Soon",
      color: "from-yellow-500 to-orange-500",
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: "Documentation",
      description: "Auto-generate documentation for your database schemas",
      status: "Coming Soon",
      color: "from-indigo-500 to-blue-500",
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Performance Monitor",
      description:
        "Real-time monitoring of query execution and database performance",
      status: "Coming Soon",
      color: "from-red-500 to-pink-500",
    },
  ];

  const stats = [
    {
      label: "Queries Executed",
      value: queryCount.toString(),
      icon: <Database className="h-5 w-5" />,
      change: "+" + queryCount,
    },
    {
      label: "AI Sessions",
      value: Math.ceil(queryCount / 3).toString(),
      icon: <MessageSquare className="h-5 w-5" />,
      change: "--",
    },
    {
      label: "Schemas Created",
      value: schemaCount.toString(),
      icon: <FileText className="h-5 w-5" />,
      change: "+" + schemaCount,
    },
    {
      label: "Performance Boost",
      value: "95%",
      icon: <TrendingUp className="h-5 w-5" />,
      change: "+5%",
    },
  ];

  const getDialectColor = (dialect: string) => {
    const colors = {
      postgresql: "from-blue-500 to-blue-600",
      mysql: "from-orange-500 to-orange-600",
      trino: "from-purple-500 to-purple-600",
      spark: "from-green-500 to-green-600",
    };
    return (
      colors[dialect as keyof typeof colors] || "from-gray-500 to-gray-600"
    );
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Aurora Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="aurora-container">
          <div className="aurora aurora-1"></div>
          <div className="aurora aurora-2"></div>
          <div className="aurora aurora-3"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Navigation with Project Selector */}
        <nav className="border-b border-gray-800/50 bg-black/20 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Database className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-white">
                    SQLMaster
                  </span>
                </div>

                {/* Project Selector */}
                {currentProject && (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setShowProjectDropdown(!showProjectDropdown)
                      }
                      className="text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-gradient-to-r ${getDialectColor(
                          currentProject.dialect
                        )}`}
                      ></div>
                      {currentProject.name}
                      <ChevronDown className="h-4 w-4" />
                    </Button>

                    {showProjectDropdown && (
                      <div className="absolute top-12 left-0 bg-gray-900 border border-gray-700 rounded-lg p-2 min-w-[200px] z-50">
                        {projects?.map((project) => (
                          <Button
                            key={project.id}
                            variant="ghost"
                            onClick={() => {
                              setCurrentProject(project);
                              setShowProjectDropdown(false);
                            }}
                            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                          >
                            <div
                              className={`w-3 h-3 rounded-full bg-gradient-to-r ${getDialectColor(
                                project.dialect
                              )} mr-2`}
                            ></div>
                            {project.name}
                          </Button>
                        ))}
                        <div className="border-t border-gray-700 mt-2 pt-2">
                          <Button
                            variant="ghost"
                            onClick={() => router.push("/projects")}
                            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Manage Projects
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <Badge
                  variant="secondary"
                  className="bg-green-500/10 text-green-400 border-green-500/20"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  Online
                </Badge>

                {/* Settings Dropdown */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                    className="text-gray-300 hover:text-white hover:bg-white/10"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  {showProjectDropdown && (
                    <div className="absolute top-12 right-0 bg-gray-900 border border-gray-700 rounded-lg p-2 min-w-[200px] z-50">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to clear all projects and data? This action cannot be undone."
                            )
                          ) {
                            clearAllContext();
                            router.push("/projects");
                          }
                        }}
                        className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      >
                        Clear All Data
                      </Button>
                    </div>
                  )}
                </div>

                <Avatar>
                  <AvatarImage src="/api/placeholder/32/32" />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    AD
                  </AvatarFallback>
                </Avatar>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="text-gray-300 hover:text-white hover:bg-white/10"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header with Project Info */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-4xl font-bold text-white">
                Welcome back, working on {currentProject?.name}
              </h1>
              <div className="flex gap-3">
                <Button
                  onClick={() => router.push("/ai-assistant")}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-6 py-3 text-lg font-medium"
                >
                  <Brain className="h-5 w-5 mr-2" />
                  AI Assistant
                </Button>
                <Button
                  onClick={() => router.push("/sql-editor")}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 text-lg font-medium"
                >
                  <Database className="h-5 w-5 mr-2" />
                  Open SQL Editor
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-gray-400 text-lg">
                Optimize your SQL queries with AI-powered insights
              </p>
              <div className="flex items-center gap-2">
                <Badge
                  className={`bg-gradient-to-r ${getDialectColor(
                    currentProject?.dialect || ""
                  )} text-white`}
                >
                  {currentProject?.dialect?.toUpperCase()}
                </Badge>
                <span className="text-gray-500">
                  Database: {currentProject?.database}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid with Project Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover:bg-gray-900/70 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {stat.value}
                      </p>
                      <p className="text-green-400 text-sm flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        {stat.change}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-lg">
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Feature Cards */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              Platform Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="group bg-gray-900/50 border-gray-800 backdrop-blur-sm hover:bg-gray-900/70 transition-all duration-300 hover:scale-105 hover:border-gray-700"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div
                        className={`p-3 rounded-lg bg-gradient-to-br ${feature.color} bg-opacity-20`}
                      >
                        {feature.icon}
                      </div>
                      <Badge
                        variant="outline"
                        className="border-gray-600 text-gray-400"
                      >
                        {feature.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 mb-4">{feature.description}</p>
                    <Button
                      variant="ghost"
                      className="w-full text-gray-300 hover:text-white hover:bg-white/10 group-hover:bg-blue-600/20 transition-all"
                      onClick={() => {
                        if (feature.title === "SQL Editor")
                          router.push("/sql-editor");
                        else if (feature.title === "AI Assistant")
                          router.push("/ai-assistant");
                        else if (feature.title === "Health Check")
                          router.push("/health");
                      }}
                    >
                      {feature.title === "SQL Editor"
                        ? "Open Editor"
                        : feature.title === "AI Assistant"
                        ? "Open AI Chat"
                        : feature.title === "Health Check"
                        ? "Check Status"
                        : "Learn More"}
                      <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Activity with Project Context */}
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentQueries.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">No recent activity</p>
                    <p className="text-gray-500 text-sm mt-1">
                      Execute queries to see your recent activity
                    </p>
                  </div>
                ) : (
                  recentQueries.map((query, index) => (
                    <div
                      key={query.id || index}
                      className="flex items-center space-x-4 p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors"
                    >
                      <div className="shrink-0">
                        {query.wasSuccessful ? (
                          <Database className="h-5 w-5 text-green-400" />
                        ) : (
                          <Database className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {query.userQuestion || "SQL Query Execution"}
                        </p>
                        <p className="text-gray-400 text-sm font-mono">
                          {query.sqlQuery.slice(0, 100)}
                          {query.sqlQuery.length > 100 ? "..." : ""}
                        </p>
                      </div>
                      <div className="text-gray-500 text-sm">
                        {new Date(query.executedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx>{`
        .aurora-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .aurora {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.3;
          animation: aurora 20s ease-in-out infinite;
        }

        .aurora-1 {
          background: linear-gradient(45deg, #3b82f6, #8b5cf6);
          width: 500px;
          height: 500px;
          top: -250px;
          left: -250px;
          animation-delay: 0s;
        }

        .aurora-2 {
          background: linear-gradient(45deg, #06b6d4, #3b82f6);
          width: 400px;
          height: 400px;
          top: 50%;
          right: -200px;
          animation-delay: -10s;
        }

        .aurora-3 {
          background: linear-gradient(45deg, #8b5cf6, #ec4899);
          width: 300px;
          height: 300px;
          bottom: -150px;
          left: 50%;
          animation-delay: -5s;
        }

        @keyframes aurora {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
            opacity: 0.3;
          }
          33% {
            transform: translateY(-30px) rotate(120deg);
            opacity: 0.5;
          }
          66% {
            transform: translateY(30px) rotate(240deg);
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}
