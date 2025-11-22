"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Database, Code, ArrowLeft } from "lucide-react";
import { SqlQueryChat } from "@/components/ai-assistant/SqlQueryChat";
import { SchemaGenerationChat } from "@/components/ai-assistant/SchemaGenerationChat";
import { useProject } from "@/contexts/ProjectContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AIAssistantPage() {
  const [activeTab, setActiveTab] = useState("query");
  const { currentProject } = useProject();
  const router = useRouter();

  // Only show loading or redirect after checking context
  useEffect(() => {
    // Don't redirect immediately on mount - wait a bit for context to load
    const timer = setTimeout(() => {
      if (!currentProject) {
        router.push("/projects");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentProject, router]);

  // Show loading while checking for project
  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
                <p className="text-sm text-gray-400">
                  Generate SQL queries and database schemas with AI
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Shared Conversation Info */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                <span className="font-semibold text-blue-400">
                  Unified Conversation:
                </span>{" "}
                Your chat history is shared across SQL Query and Schema
                Generation. Switch between tabs freely - the AI remembers your
                entire conversation.
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-gray-800 mb-8">
            <TabsTrigger
              value="query"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Code className="mr-2 h-4 w-4" />
              Query Generation
            </TabsTrigger>
            <TabsTrigger
              value="schema"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Database className="mr-2 h-4 w-4" />
              Schema Generation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="query" className="mt-0">
            <Card className="bg-gray-900 border-gray-800 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code className="h-5 w-5 text-blue-500" />
                  SQL Query Generator
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Describe what you want to query in natural language, and AI
                  will generate optimized SQL for{" "}
                  {currentProject?.name || "your project"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentProject && <SqlQueryChat project={currentProject} />}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema" className="mt-0">
            <Card className="bg-gray-900 border-gray-800 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-500" />
                  Schema Generator
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Describe your database requirements in natural language, and
                  AI will generate an optimized schema for{" "}
                  {currentProject?.name || "your project"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentProject && (
                  <SchemaGenerationChat project={currentProject} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">
                Supported Dialects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span>MySQL - Traditional RDBMS with ACID compliance</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>PostgreSQL - Advanced open-source database</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  <span>Trino - Distributed SQL query engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <span>Spark - Distributed computing SQL</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span>Natural language to SQL conversion</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span>Dialect-specific optimizations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span>Best practices and recommendations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span>Detailed explanations and rationale</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
