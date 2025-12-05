"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface Project {
  id: string;
  name: string;
  dialect: "mysql" | "postgresql" | "analytics" | "trino" | "spark";
  database?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  actualEngine?: "trino" | "spark"; // For analytics projects: tracks which engine is actually used
  csvUploads?: Array<{
    // For mysql/postgresql projects: tracks CSV upload history
    table: string;
    engine: string;
    size_mb: number;
    uploaded_at: string;
  }>;
}

export interface ProjectMetadata extends Project {
  // Schema metadata (cached in Redis)
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
  // Query intents (metadata only, no results)
  queryIntents?: Array<{
    id: string;
    sqlQuery: string;
    userQuestion?: string;
    executedAt: string;
    wasSuccessful: boolean;
    errorMessage?: string;
    tablesReferenced: string[];
    executionTimeMs: number;
  }>;
  // AI conversation sessions
  aiSessions?: Array<{
    sessionId: string;
    messages: Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }>;
    createdAt: string;
  }>;
}

export interface UserPreferences {
  autoExecute: boolean;
  explainQueries: boolean;
  skillLevel: "beginner" | "intermediate" | "advanced";
  theme: "light" | "dark";
}

interface ProjectContextType {
  // Current project
  currentProject: ProjectMetadata | null;
  projects: Project[];
  preferences: UserPreferences;

  // Project management
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => Promise<void>;
  updateProject: (
    projectId: string,
    updates: Partial<Project>
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;

  // Preferences
  updatePreferences: (prefs: Partial<UserPreferences>) => void;

  // Schema operations
  discoverSchema: (
    projectId: string,
    forceRefresh?: boolean
  ) => Promise<ProjectMetadata["schema"] | null>;
  getSchema: (projectId: string) => Promise<ProjectMetadata["schema"] | null>;

  // Query intent tracking (auto-tracked by backend on execution)
  getQueryIntents: (
    projectId: string,
    limit?: number
  ) => Promise<ProjectMetadata["queryIntents"]>;

  // AI conversations
  saveAIMessage: (
    projectId: string,
    sessionId: string,
    message: { role: "user" | "assistant"; content: string }
  ) => Promise<void>;
  getAISession: (projectId: string, sessionId: string) => Promise<any>;

  // Project statistics
  getProjectStats: (projectId: string) => Promise<any>;

  // Cleanup
  clearAllContext: () => void;
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

// ============================================================================
// CONTEXT
// ============================================================================

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProjectState] =
    useState<ProjectMetadata | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences);

  // ============================================================================
  // INITIALIZATION - Load from localStorage (lightweight: only project list & prefs)
  // ============================================================================

  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem("sequelizer-projects");
      const savedCurrentProjectId = localStorage.getItem(
        "sequelizer-current-project-id"
      );
      const savedPreferences = localStorage.getItem("sequelizer-preferences");

      if (savedProjects) {
        const parsedProjects = JSON.parse(savedProjects) as Project[];
        setProjects(parsedProjects);
      }

      if (savedCurrentProjectId && savedProjects) {
        const parsedProjects = JSON.parse(savedProjects) as Project[];
        const project = parsedProjects.find(
          (p) => p.id === savedCurrentProjectId
        );
        if (project) {
          setCurrentProjectState(project);
          // Load full context from backend
          loadProjectContext(savedCurrentProjectId);
        }
      }

      if (savedPreferences) {
        const parsedPrefs = JSON.parse(savedPreferences) as UserPreferences;
        setPreferences({ ...defaultPreferences, ...parsedPrefs });
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      localStorage.removeItem("sequelizer-projects");
      localStorage.removeItem("sequelizer-current-project-id");
    }
  }, []);

  // ============================================================================
  // SAVE TO LOCALSTORAGE (lightweight: only project list & prefs)
  // ============================================================================

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem("sequelizer-projects", JSON.stringify(projects));
    }
  }, [projects]);

  useEffect(() => {
    if (currentProject) {
      localStorage.setItem("sequelizer-current-project-id", currentProject.id);
    } else {
      localStorage.removeItem("sequelizer-current-project-id");
    }
  }, [currentProject]);

  useEffect(() => {
    localStorage.setItem("sequelizer-preferences", JSON.stringify(preferences));
  }, [preferences]);

  // ============================================================================
  // PROJECT MANAGEMENT
  // ============================================================================

  const setCurrentProject = (project: Project | null) => {
    if (project) {
      setCurrentProjectState(project);
      // Load full context from backend
      loadProjectContext(project.id);
    } else {
      setCurrentProjectState(null);
    }
  };

  const addProject = async (project: Project) => {
    // Save metadata to Redis
    try {
      await fetch(`${API_BASE_URL}/api/context/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });

      setProjects((prev) => [...prev, project]);
      setCurrentProject(project);
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    }
  };

  const updateProject = async (
    projectId: string,
    updates: Partial<Project>
  ) => {
    try {
      // Update in Redis
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        const updated = {
          ...project,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        await fetch(`${API_BASE_URL}/api/context/project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });

        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? updated : p))
        );

        if (currentProject?.id === projectId) {
          setCurrentProjectState({ ...currentProject, ...updates });
        }
      }
    } catch (error) {
      console.error("Failed to update project:", error);
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/context/project/${projectId}`, {
        method: "DELETE",
      });

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProjectState(null);
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      throw error;
    }
  };

  // ============================================================================
  // PREFERENCES
  // ============================================================================

  const updatePreferences = (prefs: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...prefs }));
  };

  // ============================================================================
  // BACKEND API FUNCTIONS
  // ============================================================================

  const loadProjectContext = async (projectId: string) => {
    try {
      // Load schema
      const schemaResponse = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/schema`
      );
      const schemaData = schemaResponse.ok ? await schemaResponse.json() : null;
      const schema = schemaData?.schema || null;

      // Load recent query intents (limit to 20 for display)
      const intentsResponse = await fetch(
        `${API_BASE_URL}/api/context/intents/${projectId}?limit=20`
      );
      const intentsData = intentsResponse.ok
        ? await intentsResponse.json()
        : { intents: [] };

      // Update current project with loaded context
      if (currentProject?.id === projectId) {
        setCurrentProjectState((prev) =>
          prev
            ? {
                ...prev,
                schema: schema?.schema || undefined,
                queryIntents: intentsData.intents || [],
              }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to load project context:", error);
    }
  };

  const discoverSchema = async (
    projectId: string,
    forceRefresh: boolean = false
  ): Promise<ProjectMetadata["schema"] | null> => {
    console.log("🔍 DiscoverSchema: Called", { projectId, forceRefresh });

    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        console.log("❌ DiscoverSchema: Project not found", projectId);
        return null;
      }

      console.log("📡 DiscoverSchema: Making API call...", {
        url: `${API_BASE_URL}/api/projects/${projectId}/schema/discover?forceRefresh=${forceRefresh}`,
        dialect: project.dialect,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/schema/discover?forceRefresh=${forceRefresh}`,
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
                ? "sales"
                : "default"),
          }),
        }
      );

      console.log("📥 DiscoverSchema: Response received", {
        status: response.status,
        ok: response.ok,
      });

      if (response.ok) {
        const data = await response.json();
        const discoveredSchema = data.schema;

        console.log("✅ DiscoverSchema: Schema data", {
          tableCount: discoveredSchema?.tables?.length || 0,
          isDiscovered: discoveredSchema?.isDiscovered,
          tables: discoveredSchema?.tables?.map((t: any) => t.name) || [],
        });

        // Update current project with discovered schema
        if (currentProject?.id === projectId) {
          console.log("🔄 DiscoverSchema: Updating currentProject state");
          setCurrentProjectState((prev) =>
            prev ? { ...prev, schema: discoveredSchema } : null
          );
        }

        // Also update the projects array to keep it in sync
        console.log("🔄 DiscoverSchema: Updating projects array");
        setProjects((prevProjects) =>
          prevProjects.map((p) =>
            p.id === projectId
              ? ({ ...p, schema: discoveredSchema } as Project)
              : p
          )
        );

        return discoveredSchema;
      }

      console.log("❌ DiscoverSchema: Response not OK");
      return null;
    } catch (error) {
      console.error("❌ DiscoverSchema: Error", error);
      throw error;
    }
  };

  const getSchema = async (
    projectId: string
  ): Promise<ProjectMetadata["schema"] | null> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/schema`
      );

      if (response.ok) {
        const data = await response.json();
        return data.schema || null;
      }
      return null;
    } catch (error) {
      console.error("Failed to get schema:", error);
      return null;
    }
  };

  const getQueryIntents = async (
    projectId: string,
    limit: number = 50
  ): Promise<ProjectMetadata["queryIntents"]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/context/intents/${projectId}?limit=${limit}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.intents || [];
      }
      return [];
    } catch (error) {
      console.error("Failed to get query intents:", error);
      return [];
    }
  };

  const saveAIMessage = async (
    projectId: string,
    sessionId: string,
    message: { role: "user" | "assistant"; content: string }
  ) => {
    try {
      await fetch(`${API_BASE_URL}/api/context/ai/${projectId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: {
            ...message,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error("Failed to save AI message:", error);
      throw error;
    }
  };

  const getAISession = async (projectId: string, sessionId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/context/ai/${projectId}/session/${sessionId}`
      );

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error("Failed to get AI session:", error);
      return null;
    }
  };

  const getProjectStats = async (projectId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/context/stats/${projectId}`
      );

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error("Failed to get project stats:", error);
      return null;
    }
  };

  // ============================================================================
  // CLEANUP
  // ============================================================================

  const clearAllContext = () => {
    localStorage.clear();
    setProjects([]);
    setCurrentProjectState(null);
    setPreferences(defaultPreferences);
  };

  // ============================================================================
  // CONTEXT PROVIDER
  // ============================================================================

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
        discoverSchema,
        getSchema,
        getQueryIntents,
        saveAIMessage,
        getAISession,
        getProjectStats,
        clearAllContext,
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
