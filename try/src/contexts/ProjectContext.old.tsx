"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface Project {
  id: string;
  name: string;
  dialect: "mysql" | "postgresql" | "trino" | "spark";
  database?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdTables: Array<{
    name: string;
    schema: string;
    createdAt: string;
  }>;
  queryHistory: Array<{
    id: string;
    query: string;
    userInput?: string;
    result?: any;
    executedAt: string;
    explanation?: string;
    status?: "success" | "error";
    executionTime?: number;
  }>;
  // Extended context fields
  schema?: {
    tables: Array<{
      name: string;
      type: "table" | "view";
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        key?: string;
        default?: any;
      }>;
    }>;
    lastSynced: string | null;
    isDiscovered: boolean;
  };
  aiConversations?: Array<{
    id: string;
    messages: Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }>;
    createdAt: string;
  }>;
  dataUploads?: Array<{
    id: string;
    filename: string;
    tableName: string;
    uploadedAt: string;
    rowCount: number;
  }>;
  settings?: Record<string, any>;
}

export interface UserPreferences {
  autoExecute: boolean;
  explainQueries: boolean;
  skillLevel: "beginner" | "intermediate" | "advanced";
  theme: "light" | "dark";
}

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  preferences: UserPreferences;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  addTableToProject: (
    projectId: string,
    table: { name: string; schema: string }
  ) => void;
  addQueryToHistory: (
    projectId: string,
    query: {
      query: string;
      userInput?: string;
      result?: unknown;
      explanation?: string;
    }
  ) => void;
  clearAllContext: () => void;
  cleanupStorage: () => void; // New cleanup function
  // Extended backend functions
  loadProjectContext: (projectId: string) => Promise<void>;
  saveProjectContext: (
    projectId: string,
    context: Record<string, unknown>
  ) => Promise<void>;
  discoverSchema: (projectId: string) => Promise<void>;
  saveQueryHistory: (
    projectId: string,
    query: string,
    results: unknown,
    executionTime: number,
    status: "success" | "error"
  ) => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  autoExecute: false,
  explainQueries: true,
  skillLevel: "intermediate",
  theme: "dark",
};

// Backend API configuration
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Storage management constants
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB limit (well under 5MB browser limit)
const MAX_QUERY_HISTORY = 100; // Maximum number of queries to keep in history
const MAX_RESULTS_SIZE = 50000; // Maximum characters for query results

// Storage utilities
const getStorageSize = (data: string): number => {
  return new Blob([data]).size;
};

const truncateQueryResults = (results: unknown): unknown => {
  if (!results) return results;

  const resultStr = JSON.stringify(results);
  if (resultStr.length <= MAX_RESULTS_SIZE) return results;

  // If results are too large, keep only first few rows
  if (Array.isArray(results) && results.length > 0) {
    const sampleSize = Math.min(10, results.length);
    return {
      ...results.slice(0, sampleSize),
      _truncated: true,
      _originalLength: results.length,
    };
  }

  return { _truncated: true, _note: "Results too large to store" };
};

const trimQueryHistory = (
  history: Project["queryHistory"]
): Project["queryHistory"] => {
  if (!history || history.length <= MAX_QUERY_HISTORY) return history;

  // Keep most recent queries
  return history
    .sort(
      (a, b) =>
        new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    )
    .slice(0, MAX_QUERY_HISTORY);
};

const safeSetItem = (key: string, value: string): boolean => {
  try {
    const size = getStorageSize(value);

    // Check if this single item is too large
    if (size > MAX_STORAGE_SIZE) {
      console.warn(`Item too large for storage: ${key} (${size} bytes)`);
      return false;
    }

    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.warn("Storage quota exceeded, attempting cleanup...");

      // Try to clear some space by removing old data
      const projects = localStorage.getItem("sequelizer-projects");
      if (projects) {
        try {
          const parsedProjects = JSON.parse(projects);
          const cleanedProjects = parsedProjects.map((project: Project) => ({
            ...project,
            queryHistory: trimQueryHistory(project.queryHistory || []).map(
              (query) => ({
                ...query,
                result: truncateQueryResults(query.result),
              })
            ),
          }));

          localStorage.setItem(
            "sequelizer-projects",
            JSON.stringify(cleanedProjects)
          );

          // Try again
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          console.error("Failed to cleanup and retry storage:", retryError);
          return false;
        }
      }
    }

    console.error("Failed to save to localStorage:", error);
    return false;
  }
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem("sequelizer-projects");
      const savedCurrentProject = localStorage.getItem(
        "sequelizer-current-project"
      );
      const savedPreferences = localStorage.getItem("sequelizer-preferences");

      if (savedProjects) {
        const parsedProjects = JSON.parse(savedProjects) as Project[];
        // Clean up projects on load - defer to avoid cascading renders
        const cleanedProjects = parsedProjects.map((project: Project) => ({
          ...project,
          queryHistory: trimQueryHistory(project.queryHistory || []),
        }));
        // Use setTimeout to defer state update
        setTimeout(() => setProjects(cleanedProjects), 0);
      }

      if (savedCurrentProject) {
        const parsedProject = JSON.parse(savedCurrentProject) as Project;
        const cleanedProject = {
          ...parsedProject,
          queryHistory: trimQueryHistory(parsedProject.queryHistory || []),
        };
        // Use setTimeout to defer state update
        setTimeout(() => setCurrentProject(cleanedProject), 0);
      }

      if (savedPreferences) {
        const parsedPrefs = JSON.parse(savedPreferences) as UserPreferences;
        setTimeout(
          () => setPreferences({ ...defaultPreferences, ...parsedPrefs }),
          0
        );
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      // Reset to clean state if data is corrupted
      localStorage.removeItem("sequelizer-projects");
      localStorage.removeItem("sequelizer-current-project");
      setTimeout(() => {
        setProjects([]);
        setCurrentProject(null);
      }, 0);
    }
  }, []);

  // Save to localStorage when data changes (with size management)
  useEffect(() => {
    if (projects.length > 0) {
      // Clean and trim data before saving
      const cleanedProjects = projects.map((project) => ({
        ...project,
        queryHistory: trimQueryHistory(project.queryHistory || []).map(
          (query) => ({
            ...query,
            result: truncateQueryResults(query.result),
          })
        ),
      }));

      const success = safeSetItem(
        "sequelizer-projects",
        JSON.stringify(cleanedProjects)
      );
      if (!success) {
        console.warn(
          "Failed to save projects to localStorage due to size constraints"
        );
      }
    }
  }, [projects]);

  useEffect(() => {
    if (currentProject) {
      // Clean current project before saving
      const cleanedProject = {
        ...currentProject,
        queryHistory: trimQueryHistory(currentProject.queryHistory || []).map(
          (query) => ({
            ...query,
            result: truncateQueryResults(query.result),
          })
        ),
      };

      const success = safeSetItem(
        "sequelizer-current-project",
        JSON.stringify(cleanedProject)
      );
      if (!success) {
        console.warn(
          "Failed to save current project to localStorage due to size constraints"
        );
      }
    } else {
      localStorage.removeItem("sequelizer-current-project");
    }
  }, [currentProject]);

  useEffect(() => {
    safeSetItem("sequelizer-preferences", JSON.stringify(preferences));
  }, [preferences]);

  const addProject = (project: Project) => {
    setProjects((prev) => [...prev, project]);
    setCurrentProject(project);
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, ...updates, updatedAt: new Date().toISOString() }
          : project
      )
    );

    if (currentProject?.id === projectId) {
      setCurrentProject((prev) =>
        prev
          ? { ...prev, ...updates, updatedAt: new Date().toISOString() }
          : null
      );
    }
  };

  const deleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
    }
  };

  const updatePreferences = (prefs: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...prefs }));
  };

  const addTableToProject = (
    projectId: string,
    table: { name: string; schema: string }
  ) => {
    const newTable = {
      ...table,
      createdAt: new Date().toISOString(),
    };

    updateProject(projectId, {
      createdTables: [
        ...(projects.find((p) => p.id === projectId)?.createdTables || []),
        newTable,
      ],
    });
  };

  const addQueryToHistory = (
    projectId: string,
    query: {
      query: string;
      userInput?: string;
      result?: unknown;
      explanation?: string;
    }
  ) => {
    const newQuery = {
      ...query,
      id: crypto.randomUUID(),
      executedAt: new Date().toISOString(),
      result: truncateQueryResults(query.result), // Truncate large results
    };

    const currentHistory =
      projects.find((p) => p.id === projectId)?.queryHistory || [];
    const updatedHistory = trimQueryHistory([...currentHistory, newQuery]);

    updateProject(projectId, {
      queryHistory: updatedHistory,
    });
  };

  const cleanupStorage = () => {
    try {
      // Force cleanup of all projects
      const cleanedProjects = projects.map((project) => ({
        ...project,
        queryHistory: trimQueryHistory(project.queryHistory || []).map(
          (query) => ({
            ...query,
            result: truncateQueryResults(query.result),
          })
        ),
      }));

      // Update state with cleaned data
      setProjects(cleanedProjects);

      // Force save to storage
      const success = safeSetItem(
        "sequelizer-projects",
        JSON.stringify(cleanedProjects)
      );

      if (currentProject) {
        const cleanedCurrentProject = {
          ...currentProject,
          queryHistory: trimQueryHistory(currentProject.queryHistory || []).map(
            (query) => ({
              ...query,
              result: truncateQueryResults(query.result),
            })
          ),
        };
        setCurrentProject(cleanedCurrentProject);
        safeSetItem(
          "sequelizer-current-project",
          JSON.stringify(cleanedCurrentProject)
        );
      }

      console.log(
        success
          ? "Storage cleanup completed successfully"
          : "Storage cleanup had issues"
      );
    } catch (error) {
      console.error("Error during storage cleanup:", error);
    }
  };

  const clearAllContext = () => {
    // Clear React state
    setCurrentProject(null);
    setProjects([]);
    setPreferences(defaultPreferences);

    // Clear localStorage completely
    try {
      localStorage.removeItem("sequelizer-projects");
      localStorage.removeItem("sequelizer-current-project");
      localStorage.removeItem("sequelizer-preferences");

      // Also clear any other potential sequelizer data
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sequelizer-")) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Error clearing localStorage:", error);
    }
  };

  // Backend API Functions
  const loadProjectContext = async (projectId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/context`
      );
      if (response.ok) {
        const context = await response.json();

        // Update current project with backend context
        if (currentProject?.id === projectId) {
          setCurrentProject((prev) =>
            prev
              ? {
                  ...prev,
                  schema: context.schema,
                  aiConversations: context.aiConversations || [],
                  dataUploads: context.dataUploads || [],
                  settings: context.settings || {},
                  // Merge query history (backend + local)
                  queryHistory: [
                    ...(context.queryHistory || []),
                    ...(prev.queryHistory || []),
                  ],
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Failed to load project context:", error);
    }
  };

  const saveProjectContext = async (
    projectId: string,
    context: Record<string, unknown>
  ) => {
    try {
      await fetch(`${API_BASE_URL}/api/projects/${projectId}/context`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
    } catch (error) {
      console.error("Failed to save project context:", error);
    }
  };

  const discoverSchema = async (projectId: string) => {
    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/schema/discover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dialect: project.dialect,
            database:
              project.database ||
              (project.dialect === "mysql"
                ? "sales"
                : project.dialect === "postgresql"
                ? "analytics"
                : project.dialect === "trino"
                ? "federated"
                : "default"),
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();

        // Update project with discovered schema
        updateProject(projectId, {
          schema: result.schema,
        });
      }
    } catch (error) {
      console.error("Failed to discover schema:", error);
    }
  };

  const saveQueryHistory = async (
    projectId: string,
    query: string,
    results: unknown,
    executionTime: number,
    status: "success" | "error"
  ) => {
    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      // Save to backend
      await fetch(`${API_BASE_URL}/api/projects/${projectId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          results,
          executionTime,
          status,
          dialect: project.dialect,
        }),
      });

      // Also update local state
      addQueryToHistory(projectId, {
        query,
        result: results,
        explanation:
          status === "success" ? "Query executed successfully" : "Query failed",
      });
    } catch (error) {
      console.error("Failed to save query history:", error);
      // Fallback to local storage only
      addQueryToHistory(projectId, {
        query,
        result: results,
        explanation:
          status === "success" ? "Query executed successfully" : "Query failed",
      });
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projects,
        preferences,
        setCurrentProject,
        addProject,
        updateProject,
        deleteProject,
        updatePreferences,
        addTableToProject,
        addQueryToHistory,
        clearAllContext,
        cleanupStorage,
        loadProjectContext,
        saveProjectContext,
        discoverSchema,
        saveQueryHistory,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
