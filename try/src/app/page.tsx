"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Brain, Zap, Database, BarChart3, Rocket, Lock } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Sequelizer Pro
                </h1>
                <p className="text-sm text-purple-200">
                  AI-Powered SQL Optimization
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                className="text-white hover:text-purple-300"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Features
              </Button>
              <Button
                asChild
                variant="ghost"
                className="text-white hover:text-purple-300"
              >
                <Link href="/docs">Documentation</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <Badge className="mb-6 bg-purple-500/20 text-purple-300 border-purple-500/30">
            Advanced SQL Optimization Platform
          </Badge>

          <h1 className="text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 leading-tight mb-8">
            Revolutionize Your
            <br />
            SQL Experience
          </h1>

          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
            Harness the power of AI-driven query optimization, multi-dialect
            support, and distributed execution engines. Transform your database
            operations with intelligent SQL generation, schema design, and
            performance analytics.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 py-4"
            >
              <Link href="/auth/register">Get Started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 py-4"
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Next-Generation SQL Platform
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Powered by cutting-edge AI and distributed computing technologies
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* AI Query Generation */}
          <Card className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 border-purple-500/30 hover:border-purple-400/50 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <CardTitle className="text-white">AI Query Generation</CardTitle>
              <CardDescription className="text-gray-300">
                FAISS-powered RAG system with Groq LLM and Cohere reranking for
                intelligent SQL query generation across multiple dialects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Llama 3.3-70B model integration</li>
                <li>• Context-aware query suggestions</li>
                <li>• Multi-dialect SQL generation</li>
              </ul>
            </CardContent>
          </Card>

          {/* Multi-Engine Execution */}
          <Card className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-blue-500/30 hover:border-blue-400/50 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <CardTitle className="text-white">
                Multi-Engine Execution
              </CardTitle>
              <CardDescription className="text-gray-300">
                Execute queries across MySQL, Trino, Spark, and PostgreSQL with
                unified interface and intelligent routing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Seamless engine switching</li>
                <li>• Distributed query processing</li>
                <li>• Performance-optimized caching</li>
              </ul>
            </CardContent>
          </Card>

          {/* Schema Intelligence */}
          <Card className="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-emerald-400" />
              </div>
              <CardTitle className="text-white">Schema Intelligence</CardTitle>
              <CardDescription className="text-gray-300">
                AI-powered database schema generation and visualization with
                intelligent recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Automated schema design</li>
                <li>• Relationship mapping</li>
                <li>• Performance optimization</li>
              </ul>
            </CardContent>
          </Card>

          {/* Analytics Dashboard */}
          <Card className="bg-gradient-to-br from-orange-900/50 to-red-900/50 border-orange-500/30 hover:border-orange-400/50 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-orange-400" />
              </div>
              <CardTitle className="text-white">Advanced Analytics</CardTitle>
              <CardDescription className="text-gray-300">
                Comprehensive performance tracking with real-time metrics and
                optimization insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Query performance metrics</li>
                <li>• Usage pattern analysis</li>
                <li>• Optimization recommendations</li>
              </ul>
            </CardContent>
          </Card>

          {/* Microservices Architecture */}
          <Card className="bg-gradient-to-br from-pink-900/50 to-rose-900/50 border-pink-500/30 hover:border-pink-400/50 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center mb-4">
                <Rocket className="w-6 h-6 text-pink-400" />
              </div>
              <CardTitle className="text-white">Microservices Ready</CardTitle>
              <CardDescription className="text-gray-300">
                Scalable architecture with API gateway, health monitoring, and
                distributed services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Service mesh integration</li>
                <li>• Health check endpoints</li>
                <li>• Load balancing support</li>
              </ul>
            </CardContent>
          </Card>

          {/* Enterprise Security */}
          <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-500/30 hover:border-indigo-400/50 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-indigo-400" />
              </div>
              <CardTitle className="text-white">Enterprise Security</CardTitle>
              <CardDescription className="text-gray-300">
                Built-in authentication, authorization, and data protection for
                enterprise deployments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Multi-user support</li>
                <li>• Role-based access control</li>
                <li>• Audit trail logging</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-3xl border border-purple-500/30 p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your SQL Operations?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join the future of database management with AI-powered optimization
            and multi-engine execution.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 py-4"
            >
              <Link href="/auth/register">Get Started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 py-4"
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="text-white font-semibold">Sequelizer Pro</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2025 Sequelizer Pro. Powered by advanced AI and distributed
              computing.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
