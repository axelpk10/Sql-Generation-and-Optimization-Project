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
  schema?: string;
  explanation?: string;
  optimizations?: string;
  bestPractices?: Array<{
    title: string;
    description: string;
    category: string;
  }>;
  dialectFeatures?: string[];
}

interface SchemaGenerationChatProps {
  project: Project;
}

export function SchemaGenerationChat({ project }: SchemaGenerationChatProps) {
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [schema, setSchema] = useState<any>(null);

  // Load schema and conversation history on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch current schema
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
      } catch (error) {
        console.error("Failed to fetch schema:", error);
      }
    };
    
    const loadConversation = async () => {
      try {
        const sessionId = "ai_assistant_session"; // Shared session for both query and schema
        const response = await fetch(
          `http://localhost:8000/api/context/ai/${project.id}/session/${sessionId}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            // Load all messages from shared session
            const loadedMessages = data.messages.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              schema: msg.schema,
              explanation: msg.explanation,
              optimizations: msg.optimizations,
              bestPractices: msg.bestPractices,
              dialectFeatures: msg.dialectFeatures,
            }));
            setMessages(loadedMessages);
            console.log(
              "✅ Loaded shared conversation:",
              loadedMessages.length,
              "messages"
            );
          } else {
            console.log("📝 Starting new conversation");
          }
        }
      } catch (error) {
        console.error("Failed to load conversation:", error);
      }
    };
    
    loadData();
    loadConversation();
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save message to Redis (shared session with query chat)
  const saveMessageToRedis = async (message: Message) => {
    try {
      const sessionId = "ai_assistant_session"; // Shared session
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
              schema: message.schema,
              explanation: message.explanation,
              optimizations: message.optimizations,
              bestPractices: message.bestPractices,
              dialectFeatures: message.dialectFeatures,
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
    setIsLoading(true);

    try {
      // Prepare existing schema context
      const existingSchemaContext = schema
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

      console.log(
        "[SchemaGen Frontend] Sending existing_schema:",
        existingSchemaContext
          ? `${existingSchemaContext.totalTables} tables: ${existingSchemaContext.tables.slice(0, 3).map((t: any) => t.name).join(", ")}`
          : "null"
      );

      const response = await fetch("http://localhost:5001/generate-schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirements: input,
          dialect: selectedDialect,
          project_id: project.id,
          project_name: project.name,
          existing_schema: existingSchemaContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate schema");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: "Here's the database schema I designed for you:",
        schema: data.schema,
        explanation: data.explanation,
        optimizations: data.optimizations,
        bestPractices: data.best_practices,
        dialectFeatures: data.dialect_features,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      saveMessageToRedis(assistantMessage); // Save to Redis
    } catch (error) {
      console.error("Error generating schema:", error);
      console.error(
        "Failed to generate schema:",
        error instanceof Error
          ? error.message
          : "Please make sure the backend service is running on port 5001."
      );

      const errorMessage: Message = {
        role: "assistant",
        content:
          "I'm sorry, I encountered an error while generating your schema. Please make sure the Schema Generation service is running on port 5001 and try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleQuery = () => {
    setInput(
      "Create a schema for an e-commerce platform with products, customers, orders, and inventory management"
    );
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Project Dialect Indicator */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm text-gray-400">Database Dialect:</label>
            <span className="ml-3 px-3 py-1 rounded-md text-sm font-medium bg-purple-600 text-white">
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

                  {/* Schema Display */}
                  {message.schema && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-blue-400">
                          Generated Schema:
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(message.schema!, index)}
                          className="h-8 px-2 text-gray-400 hover:text-white"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span className="ml-1 text-xs">Copy All DDL</span>
                        </Button>
                      </div>

                      {/* Parse and display individual tables */}
                      {(() => {
                        const tables = message.schema
                          .split(/CREATE TABLE/i)
                          .filter(Boolean);
                        return tables.map((table, tblIdx) => {
                          // Extract table name
                          const nameMatch = table.match(
                            /[\s`\"\[]?([a-zA-Z_][a-zA-Z0-9_]*)[\s`\"\]]?\s*\(/i
                          );
                          const tableName = nameMatch
                            ? nameMatch[1]
                            : `Table ${tblIdx + 1}`;
                          const fullDDL = `CREATE TABLE${table}`;

                          return (
                            <div
                              key={tblIdx}
                              className="bg-gray-900 rounded-md border border-gray-700 overflow-hidden"
                            >
                              <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Database className="h-4 w-4 text-purple-400" />
                                  <span className="font-mono text-sm font-semibold text-purple-300">
                                    {tableName}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleCopy(fullDDL, index * 100 + tblIdx)
                                  }
                                  className="h-6 px-2 text-gray-400 hover:text-white"
                                >
                                  {copiedIndex === index * 100 + tblIdx ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                              <pre className="p-3 overflow-x-auto text-xs text-green-400 max-h-64">
                                {fullDDL.trim()}
                              </pre>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* Dialect Features */}
                  {message.dialectFeatures &&
                    message.dialectFeatures.length > 0 && (
                      <div className="mt-4">
                        <span className="text-sm font-semibold text-cyan-400 block mb-2">
                          Dialect-Specific Features Used:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {message.dialectFeatures.map((feature, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
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
            Try an example schema
          </Button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Describe your ${selectedDialect.toUpperCase()} schema requirements...`}
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
