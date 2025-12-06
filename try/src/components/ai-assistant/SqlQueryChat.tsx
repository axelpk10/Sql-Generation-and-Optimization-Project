"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Send, User, Sparkles, Copy, Check, Database, Trash2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  dialect: string;
  database?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sqlQuery?: string;
  explanation?: string;
  optimizations?: string;
  bestPractices?: Array<{
    title: string;
    description: string;
    category: string;
  }>;
}

interface SqlQueryChatProps {
  project: Project;
}

export function SqlQueryChat({ project }: SqlQueryChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I'm your AI Assistant for ${
        project.name
      }. I can help you with SQL queries and database schemas for your ${project.dialect.toUpperCase()} project. Your conversation history is shared across all AI features. How can I help you today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const selectedDialect = project.dialect || "mysql"; // Auto-select from project
  const [schema, setSchema] = useState<any>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Fetch project schema and conversation history on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch schema
        const schemaResponse = await fetch(
          `http://localhost:8000/api/projects/${project.id}/schema`
        );
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          setSchema(schemaData.schema);
          console.log(
            "Loaded project schema:",
            schemaData.schema?.tables?.length || 0,
            "tables"
          );
        }

        // Fetch previous conversation (shared with schema chat)
        const sessionId = "ai_assistant_session"; // Shared session for complete AI assistant
        const conversationResponse = await fetch(
          `http://localhost:8000/api/context/ai/${project.id}/session/${sessionId}`
        );
        if (conversationResponse.ok) {
          const conversationData = await conversationResponse.json();
          if (
            conversationData.messages &&
            conversationData.messages.length > 0
          ) {
            // Convert stored messages to component format
            const loadedMessages = conversationData.messages.map(
              (msg: any) => ({
                role: msg.role,
                content: msg.content,
                sqlQuery: msg.sqlQuery,
                explanation: msg.explanation,
                optimizations: msg.optimizations,
                bestPractices: msg.bestPractices,
              })
            );
            setMessages(loadedMessages);
            console.log(
              "✅ Loaded conversation history:",
              loadedMessages.length,
              "messages"
            );
          } else {
            console.log("📝 Starting new conversation");
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, [project.id]);

  const handleClearChat = async () => {
    if (!confirm("Are you sure you want to clear the chat history? This will reset the conversation context for both SQL Query and Schema Generation.")) {
      return;
    }

    setIsClearing(true);
    try {
      const sessionId = "ai_assistant_session";
      const response = await fetch(
        `http://localhost:8000/api/context/ai/${project.id}/session/${sessionId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Reset to initial welcome message
        setMessages([
          {
            role: "assistant",
            content: `Hello! I'm your AI Assistant for ${
              project.name
            }. I can help you with SQL queries and database schemas for your ${project.dialect.toUpperCase()} project. Your conversation history is shared across all AI features. How can I help you today?`,
          },
        ]);
        console.log("✅ Chat history cleared");
      } else {
        throw new Error("Failed to clear chat history");
      }
    } catch (error) {
      console.error("Error clearing chat:", error);
      alert("Failed to clear chat history. Please try again.");
    } finally {
      setIsClearing(false);
    }
  };
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save message to Redis (shared session with schema chat)
  const saveMessageToRedis = async (message: Message) => {
    try {
      const sessionId = "ai_assistant_session"; // Shared session for both query and schema
      await fetch(
        `http://localhost:8000/api/context/ai/${project.id}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: {
              role: message.role,
              content: message.content,
              sqlQuery: message.sqlQuery,
              explanation: message.explanation,
              optimizations: message.optimizations,
              bestPractices: message.bestPractices,
              timestamp: new Date().toISOString(),
            },
          }),
        }
      );
    } catch (error) {
      console.error("Failed to save message to Redis:", error);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      console.log("Copied to clipboard!");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    saveMessageToRedis(userMessage); // Save to Redis
    setInput("");
    setIsLoading(true);

    try {
      // Prepare schema context for AI
      const schemaContext = schema
        ? {
            tables:
              schema.tables?.map((t: any) => ({
                name: t.name,
                columns:
                  t.columns
                    ?.map((c: any) => `${c.name} (${c.type})`)
                    .join(", ") || "",
              })) || [],
            totalTables: schema.tables?.length || 0,
          }
        : null;

      const response = await fetch("http://localhost:5000/api/sql/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_query: input,
          dialect: selectedDialect,
          project_id: project.id,
          project_name: project.name,
          schema_context: schemaContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "error") {
        throw new Error(data.message || "Failed to generate query");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: "Here's the SQL query I generated for you:",
        sqlQuery: data.data.sql_query,
        explanation: data.data.explanation,
        optimizations: data.data.optimizations,
        bestPractices: data.data.best_practices,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      saveMessageToRedis(assistantMessage); // Save to Redis
    } catch (error) {
      console.error("Error generating query:", error);
      console.error(
        "Failed to generate query:",
        error instanceof Error
          ? error.message
          : "Please make sure the backend service is running on port 5000."
      );

      const errorMessage: Message = {
        role: "assistant",
        content:
          "I'm sorry, I encountered an error while generating your query. Please make sure the SQL Query Generator service is running on port 5000 and try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleQuery = () => {
    setInput(
      "Show me the top 10 customers by total orders in the last 6 months"
    );
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Project Dialect Indicator */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm text-gray-400">Database Dialect:</label>
            <span className="ml-3 px-3 py-1 rounded-md text-sm font-medium bg-blue-600 text-white">
              {selectedDialect.toUpperCase()}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            disabled={isClearing || messages.length <= 1}
            className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Auto-selected from project settings
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-800/30 rounded-lg border border-gray-700">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex max-w-[85%] ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`flex-shrink-0 ${
                  message.role === "user" ? "ml-3" : "mr-3"
                }`}
              >
                <Avatar>
                  <AvatarFallback
                    className={
                      message.role === "user" ? "bg-blue-600" : "bg-purple-600"
                    }
                  >
                    {message.role === "user" ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1">
                <div
                  className={`p-4 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-200 border border-gray-700"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* SQL Query Display */}
                  {message.sqlQuery && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-blue-400">
                          Generated Query:
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Save query to localStorage and navigate to SQL Editor
                              localStorage.setItem(
                                "pendingQuery",
                                message.sqlQuery!
                              );
                              // Use Next.js router for client-side navigation (preserves context)
                              window.location.href = "/sql-editor";
                            }}
                            className="h-8 px-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                          >
                            <Database className="h-4 w-4 mr-1" />
                            Open in Editor
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(message.sqlQuery!, index)}
                            className="h-8 px-2 text-gray-400 hover:text-white"
                          >
                            {copiedIndex === index ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <pre className="bg-gray-900 p-3 rounded-md overflow-x-auto text-sm text-green-400 border border-gray-700">
                        {message.sqlQuery}
                      </pre>
                    </div>
                  )}

                  {/* Explanation */}
                  {message.explanation && (
                    <div className="mt-4">
                      <span className="text-sm font-semibold text-purple-400 block mb-2">
                        Explanation:
                      </span>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {message.explanation}
                      </p>
                    </div>
                  )}

                  {/* Optimizations */}
                  {message.optimizations && (
                    <div className="mt-4">
                      <span className="text-sm font-semibold text-orange-400 block mb-2">
                        Optimizations:
                      </span>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {message.optimizations}
                      </p>
                    </div>
                  )}

                  {/* Best Practices */}
                  {message.bestPractices &&
                    message.bestPractices.length > 0 && (
                      <div className="mt-4">
                        <span className="text-sm font-semibold text-green-400 block mb-2">
                          Best Practices:
                        </span>
                        <div className="space-y-2">
                          {message.bestPractices.map((practice, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-900/50 p-2 rounded border border-gray-700"
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-400 mt-0.5">
                                  {practice.category}
                                </span>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-200">
                                    {practice.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {practice.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-purple-600">
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex space-x-2">
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example Query Button */}
      {messages.length === 1 && (
        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
            onClick={handleExampleQuery}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Try an example query
          </Button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Describe your ${selectedDialect.toUpperCase()} query needs...`}
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
