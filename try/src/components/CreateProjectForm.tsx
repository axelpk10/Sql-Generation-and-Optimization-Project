"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject, type Project } from "@/contexts/ProjectContext";
import { Database, Loader2, CheckCircle } from "lucide-react";

// Database mapping for each dialect
const getDefaultDatabase = (dialect: string) => {
  switch (dialect) {
    case "mysql":
      return "sales";
    case "postgresql":
      return "analytics";
    case "analytics":
      return "data";
    case "spark":
      return "data";
    case "trino":
      return "federated"; // Placeholder, Trino uses catalogs
    default:
      return "default";
  }
};

// Enhanced dialect information
const dialectInfo = {
  mysql: {
    name: "MySQL",
    description: "Traditional Database",
    details: "CRUD operations, schema design, relational data",
    useCase: "Perfect for e-commerce, user management, business apps",
    icon: "🔧",
    color: "from-orange-500 to-orange-600",
  },
  postgresql: {
    name: "PostgreSQL",
    description: "Advanced Database",
    details: "Advanced queries, JSON data, complex analytics",
    useCase: "Perfect for dashboards, reporting, data warehousing",
    icon: "📊",
    color: "from-blue-500 to-blue-600",
  },
  analytics: {
    name: "Analytics Engine",
    description: "Upload & Process Data",
    details: "CSV upload, smart processing (Trino/Spark), federated queries",
    useCase: "Perfect for CSV analysis, cross-database queries, big data",
    icon: "⚡",
    color: "from-purple-500 to-orange-500",
  },
};

interface CreateProjectFormProps {
  onCancel: () => void;
}

export default function CreateProjectForm({
  onCancel,
}: CreateProjectFormProps) {
  const router = useRouter();
  const { addProject } = useProject();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dialect: "mysql" as "mysql" | "postgresql" | "analytics" | "trino" | "spark",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    setCreationStep(1);

    try {
      // Validate form
      if (!formData.name.trim()) {
        throw new Error("Project name is required");
      }

      // Simulate project creation steps
      setCreationStep(1); // Creating project structure
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCreationStep(2); // Setting up project configuration
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create the project
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: formData.name.trim(),
        dialect: formData.dialect,
        database: getDefaultDatabase(formData.dialect), // Use default database based on dialect
        description: formData.description.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCreationStep(3); // Finalizing setup
      await new Promise((resolve) => setTimeout(resolve, 800));

      addProject(newProject);
      setCreationStep(4); // Complete

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Redirect to dashboard with the new project
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreating(false);
      setCreationStep(0);
    }
  };

  const getStepMessage = () => {
    switch (creationStep) {
      case 1:
        return "Creating project structure...";
      case 2:
        return "Setting up project configuration...";
      case 3:
        return "Finalizing project setup...";
      case 4:
        return "Project created successfully!";
      default:
        return "";
    }
  };

  if (isCreating) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-6">
            {creationStep < 4 ? (
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            ) : (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {creationStep < 4 ? "Creating Your Project" : "Project Ready!"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {getStepMessage()}
              </p>
            </div>
            {creationStep < 4 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(creationStep / 3) * 100}%` }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Create New Project
        </CardTitle>
        <CardDescription>
          Set up a new SQL project with your preferred database dialect
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="My SQL Project"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Brief description of your project"
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Database Engine</Label>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(dialectInfo).map(([key, info]) => (
                <div
                  key={key}
                  className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all hover:shadow-md ${
                    formData.dialect === key
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, dialect: key as any }))
                  }
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-white text-sm`}
                    >
                      {info.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {info.name}
                        </h3>
                        <span className="text-xs font-medium text-blue-600">
                          {info.description}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">
                        {info.details}
                      </p>
                      <p className="text-xs text-gray-500">{info.useCase}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.dialect === key
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
                      >
                        {formData.dialect === key && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Project
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
