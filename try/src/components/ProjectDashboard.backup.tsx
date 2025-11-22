'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProject } from '@/contexts/ProjectContext'
import CreateProjectForm from '@/components/CreateProjectForm'
import { 
  Plus, 
  Database, 
  Calendar, 
  Clock, 
  Table, 
  History,
  Settings,
  Trash2,
  Edit
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function ProjectDashboard() {
  const { projects, currentProject, setCurrentProject, deleteProject } = useProject()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  const handleSelectProject = (project: any) => {
    setCurrentProject(project)
  }

  const handleDeleteProject = (projectId: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      deleteProject(projectId)
    }
  }

  const getDialectColor = (dialect: string) => {
    const colors = {
      postgresql: 'bg-blue-100 text-blue-800',
      mysql: 'bg-orange-100 text-orange-800',
      trino: 'bg-purple-100 text-purple-800',
      spark: 'bg-green-100 text-green-800'
    }
    return colors[dialect as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
            <p className="text-gray-600 mt-2">Set up your SQL workspace with intelligent AI assistance</p>
          </div>
          <CreateProjectForm onCancel={() => setShowCreateForm(false)} />
        </div>
      </div>
    )
  }

  if (currentProject) {
    // Show the project workspace
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentProject(null)}
                >
                  ← Back to Projects
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{currentProject.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDialectColor(currentProject.dialect)}`}>
                      {currentProject.dialect.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">Database: {currentProject.database}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/ai-assistant" className="block">
                    <Button className="w-full justify-start" variant="outline">
                      💡 Generate SQL with AI
                    </Button>
                  </Link>
                  <Link href="/sql-editor" className="block">
                    <Button className="w-full justify-start" variant="outline">
                      ⚡ SQL Editor
                    </Button>
                  </Link>
                  <Button className="w-full justify-start" variant="outline">
                    📊 Create Schema
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    🔍 Explore Database
                  </Button>
                </CardContent>
              </Card>

              {/* Project Stats */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Project Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Tables Created</span>
                      <span className="font-semibold">{currentProject.createdTables.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Queries Executed</span>
                      <span className="font-semibold">{currentProject.queryHistory.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Created</span>
                      <span className="text-sm">{formatDistanceToNow(new Date(currentProject.createdAt))} ago</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Last Updated</span>
                      <span className="text-sm">{formatDistanceToNow(new Date(currentProject.updatedAt))} ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Tables */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Table className="h-5 w-5" />
                    Recent Tables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentProject.createdTables.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Table className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No tables created yet</p>
                      <p className="text-sm">Start by generating a schema or creating tables manually</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentProject.createdTables.slice(-3).map((table, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <h4 className="font-medium">{table.name}</h4>
                            <p className="text-sm text-gray-500">
                              Created {formatDistanceToNow(new Date(table.createdAt))} ago
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            View Schema
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Queries */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Recent Queries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentProject.queryHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No queries executed yet</p>
                      <p className="text-sm">Use the AI Assistant or SQL Editor to run your first query</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentProject.queryHistory.slice(-3).map((query, index) => (
                        <div key={query.id || index} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <code className="text-sm bg-white px-2 py-1 rounded border">
                              {query.query.slice(0, 50)}...
                            </code>
                            {query.userInput && (
                              <p className="text-sm text-gray-600 mt-1">"{query.userInput}"</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(query.executedAt))} ago
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show projects list
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your SQL Projects</h1>
            <p className="text-gray-600 mt-2">Create and manage your database projects with AI-powered assistance</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Database className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <CardTitle className="text-xl mb-2">No Projects Yet</CardTitle>
              <CardDescription className="mb-6">
                Create your first SQL project to start generating queries with AI assistance
              </CardDescription>
              <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Database className="h-5 w-5" />
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="mt-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProject(project.id, project.name)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent onClick={() => handleSelectProject(project)}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDialectColor(project.dialect)}`}>
                        {project.dialect.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">Database: {project.database}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Table className="h-4 w-4 text-gray-400" />
                        <span>{project.createdTables.length} Tables</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-gray-400" />
                        <span>{project.queryHistory.length} Queries</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                      <Calendar className="h-3 w-3" />
                      Created {formatDistanceToNow(new Date(project.createdAt))} ago
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}