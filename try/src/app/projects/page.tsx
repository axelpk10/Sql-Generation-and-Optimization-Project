"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProject, Project } from "@/contexts/ProjectContext";
import CreateProjectForm from "@/components/CreateProjectForm";
import {
  Plus,
  Database,
  Calendar,
  Table,
  History,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProjectsPage() {
  const router = useRouter();
  const {
    projects,
    currentProject,
    setCurrentProject,
    addProject,
    deleteProject,
    clearAllContext,
  } = useProject();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Just check if context is loaded, don't auto-redirect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    // Navigate to dashboard after setting project
    router.push("/dashboard");
  };

  const handleCreateProject = () => {
    setShowCreateForm(true);
  };

  const handleDeleteProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (
      confirm(
        `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
      )
    ) {
      deleteProject(project.id);
      // If deleted project was current, clear current project
      if (currentProject?.id === project.id) {
        setCurrentProject(null);
      }
    }
  };

  const getDialectColor = (dialect: string) => {
    const colors = {
      postgresql: "from-blue-500 to-blue-600",
      mysql: "from-orange-500 to-orange-600",
      trino: "from-purple-500 to-purple-600",
      spark: "from-yellow-500 to-orange-500",
    };
    return (
      colors[dialect as keyof typeof colors] || "from-gray-500 to-gray-600"
    );
  };

  const getDialectBadgeColor = (dialect: string) => {
    const colors = {
      postgresql: "bg-blue-100 text-blue-800 border-blue-200",
      mysql: "bg-orange-100 text-orange-800 border-orange-200",
      trino: "bg-purple-100 text-purple-800 border-purple-200",
      spark: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };
    return (
      colors[dialect as keyof typeof colors] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    );
  };

  const getDialectInfo = (dialect: string) => {
    const info = {
      postgresql: {
        name: "PostgreSQL",
        description: "Analytics & Reporting",
        icon: "📊",
      },
      mysql: { name: "MySQL", description: "Build Applications", icon: "🔧" },
      trino: {
        name: "Trino",
        description: "Cross-Database Analytics",
        icon: "🌐",
      },
      spark: {
        name: "Apache Spark",
        description: "Process Large Datasets",
        icon: "⚡",
      },
    };
    return (
      info[dialect as keyof typeof info] || {
        name: dialect,
        description: "Database",
        icon: "💾",
      }
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="text-white text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p>Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Aurora Background - Same as Dashboard */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="aurora-container">
          <div className="aurora aurora-1"></div>
          <div className="aurora aurora-2"></div>
          <div className="aurora aurora-3"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="bg-black/20 backdrop-blur-xl border-b border-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-4">
                  <Database className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white">
                  SQLMaster Projects
                </h1>
              </div>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-6">
                Select a project to continue or create a new one to start
                generating SQL with AI
              </p>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                {currentProject && (
                  <Button
                    onClick={() => router.push("/dashboard")}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  >
                    Continue with {currentProject.name}
                  </Button>
                )}
                <Button
                  onClick={() => clearAllContext()}
                  variant="outline"
                  className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                >
                  Clear All Projects
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Show Create Form if active */}
          {showCreateForm ? (
            <div className="max-w-md mx-auto">
              <div className="mb-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-white mb-4"
                >
                  ← Back to Projects
                </Button>
              </div>
              <CreateProjectForm onCancel={() => setShowCreateForm(false)} />
            </div>
          ) : (
            <>
              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Create New Project Card */}
                <Card
                  className="group bg-gray-900/50 border-gray-800 backdrop-blur-sm hover:bg-gray-900/70 transition-all duration-300 hover:scale-105 hover:border-blue-500/50 cursor-pointer"
                  onClick={handleCreateProject}
                >
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <Plus className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-white text-xl mb-2">
                      Create New Project
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Start a new SQL project with AI-powered query generation
                    </CardDescription>
                    <div className="mt-6 flex items-center justify-center text-blue-400 group-hover:text-blue-300 transition-colors">
                      <Sparkles className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">Get Started</span>
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>

                {/* Existing Projects */}
                {projects?.map((project) => (
                  <Card
                    key={project.id}
                    className="group bg-gray-900/50 border-gray-800 backdrop-blur-sm hover:bg-gray-900/70 transition-all duration-300 hover:scale-105 hover:border-gray-700 cursor-pointer relative"
                    onClick={() => handleSelectProject(project)}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-3 text-lg text-white group-hover:text-blue-400 transition-colors">
                            <div
                              className={`w-4 h-4 rounded-full bg-gradient-to-r ${getDialectColor(
                                project.dialect
                              )}`}
                            ></div>
                            {project.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1 mb-2">
                            <Badge
                              className={getDialectBadgeColor(project.dialect)}
                            >
                              {getDialectInfo(project.dialect).name}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {getDialectInfo(project.dialect).description}
                            </span>
                          </div>
                          {project.description && (
                            <CardDescription className="mt-2 text-gray-400">
                              {project.description}
                            </CardDescription>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteProject(project, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <span className="text-xs">✕</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Dialect Info - Now more prominent */}
                        <div className="flex items-center gap-2">
                          <Badge
                            className={getDialectBadgeColor(project.dialect)}
                          >
                            {project.dialect.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Database: {project.database}
                          </span>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Table className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-300">
                              {project.createdTables?.length || 0} Tables
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-300">
                              {project.queryHistory?.length || 0} Queries
                            </span>
                          </div>
                        </div>

                        {/* Date Info */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-700">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Created{" "}
                            {formatDistanceToNow(new Date(project.createdAt))}{" "}
                            ago
                          </span>
                        </div>

                        {/* Hover Action */}
                        <div className="flex items-center justify-center text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                          <span className="text-sm font-medium">
                            Open Project
                          </span>
                          <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Empty State */}
              {projects.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Database className="h-12 w-12 text-gray-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    No Projects Yet
                  </h3>
                  <p className="text-gray-400 max-w-md mx-auto mb-8">
                    Create your first project to start generating SQL queries
                    with AI assistance. Choose your database dialect and get
                    started in minutes.
                  </p>
                  <Button
                    onClick={handleCreateProject}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Project
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Aurora Animation Styles */}
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
