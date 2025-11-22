"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Database, BookOpen, Copy, CheckCircle } from "lucide-react";

interface FederatedTemplate {
  name: string;
  description: string;
  category: "Discovery" | "Federation" | "Analytics";
  query: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

const FEDERATED_TEMPLATES: FederatedTemplate[] = [
  {
    name: "Show All Catalogs",
    description: "List all available data sources (MySQL, PostgreSQL, etc.)",
    category: "Discovery",
    query: "SHOW CATALOGS;",
    difficulty: "Beginner",
  },
  {
    name: "List MySQL Tables",
    description: "Show all tables in MySQL sales database",
    category: "Discovery",
    query: "SHOW TABLES FROM mysql.sales;",
    difficulty: "Beginner",
  },
  {
    name: "List PostgreSQL Tables",
    description: "Show all tables in PostgreSQL analytics database",
    category: "Discovery",
    query: "SHOW TABLES FROM postgresql.analytics;",
    difficulty: "Beginner",
  },
  {
    name: "Describe Table Structure",
    description: "View column names and types for a table",
    category: "Discovery",
    query: "DESCRIBE mysql.sales.orders;",
    difficulty: "Beginner",
  },
  {
    name: "Cross-Database Record Count",
    description: "Compare record counts from MySQL and PostgreSQL",
    category: "Federation",
    query: `SELECT 'MySQL Sales' as source, COUNT(*) as record_count
FROM mysql.sales.orders
UNION ALL
SELECT 'PostgreSQL Analytics', COUNT(*)
FROM postgresql.analytics.metrics;`,
    difficulty: "Beginner",
  },
  {
    name: "Query MySQL Data",
    description: "Simple SELECT from MySQL sales orders",
    category: "Analytics",
    query: `SELECT 
  order_id,
  customer_id,
  total_amount,
  order_date
FROM mysql.sales.orders
ORDER BY order_date DESC
LIMIT 10;`,
    difficulty: "Beginner",
  },
  {
    name: "Query PostgreSQL Data",
    description: "Simple SELECT from PostgreSQL analytics",
    category: "Analytics",
    query: `SELECT 
  metric_name,
  metric_value,
  recorded_at
FROM postgresql.analytics.metrics
ORDER BY recorded_at DESC
LIMIT 10;`,
    difficulty: "Beginner",
  },
  {
    name: "Federated Join (Basic)",
    description: "Join data from MySQL and PostgreSQL databases",
    category: "Federation",
    query: `-- Join sales data (MySQL) with analytics (PostgreSQL)
SELECT 
  o.order_id,
  o.customer_id,
  o.total_amount,
  m.metric_value,
  m.recorded_at
FROM mysql.sales.orders o
LEFT JOIN postgresql.analytics.metrics m
  ON o.customer_id = m.customer_id
WHERE o.order_date >= DATE '2025-01-01'
LIMIT 10;`,
    difficulty: "Intermediate",
  },
  {
    name: "Multi-Source Aggregation",
    description: "Aggregate data from multiple databases",
    category: "Federation",
    query: `-- Compare sales performance across databases
WITH mysql_stats AS (
  SELECT 
    COUNT(*) as order_count,
    SUM(total_amount) as total_revenue
  FROM mysql.sales.orders
),
postgres_stats AS (
  SELECT 
    COUNT(*) as metric_count,
    AVG(metric_value) as avg_metric
  FROM postgresql.analytics.metrics
)
SELECT 
  m.order_count,
  m.total_revenue,
  p.metric_count,
  p.avg_metric
FROM mysql_stats m
CROSS JOIN postgres_stats p;`,
    difficulty: "Advanced",
  },
  {
    name: "Cross-Database Analytics",
    description: "Analyze data patterns across multiple sources",
    category: "Analytics",
    query: `-- Customer behavior across systems
SELECT 
  o.customer_id,
  COUNT(DISTINCT o.order_id) as total_orders,
  SUM(o.total_amount) as total_spent,
  AVG(m.metric_value) as avg_engagement
FROM mysql.sales.orders o
LEFT JOIN postgresql.analytics.metrics m
  ON o.customer_id = m.customer_id
GROUP BY o.customer_id
HAVING COUNT(DISTINCT o.order_id) > 1
ORDER BY total_spent DESC
LIMIT 20;`,
    difficulty: "Advanced",
  },
];

interface FederatedQueryTemplatesProps {
  onTemplateSelect: (query: string) => void;
  projectDialect?: string;
}

export function FederatedQueryTemplates({
  onTemplateSelect,
  projectDialect,
}: FederatedQueryTemplatesProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("All");

  // Only show for Trino projects
  if (projectDialect !== "trino") {
    return null;
  }

  const categories = ["All", "Discovery", "Federation", "Analytics"];

  const filteredTemplates =
    filterCategory === "All"
      ? FEDERATED_TEMPLATES
      : FEDERATED_TEMPLATES.filter((t) => t.category === filterCategory);

  const handleCopy = async (query: string, index: number) => {
    try {
      await navigator.clipboard.writeText(query);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-900/50 text-green-300 border-green-700";
      case "Intermediate":
        return "bg-yellow-900/50 text-yellow-300 border-yellow-700";
      case "Advanced":
        return "bg-red-900/50 text-red-300 border-red-700";
      default:
        return "bg-gray-900/50 text-gray-300 border-gray-700";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Discovery":
        return "🔍";
      case "Federation":
        return "🔗";
      case "Analytics":
        return "📊";
      default:
        return "📝";
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-600 text-purple-300 hover:bg-purple-900/30"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Federated Query Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center space-x-2">
            <Database className="h-5 w-5 text-purple-400" />
            <span>Federated Query Templates</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Pre-built queries for cross-database analytics with Trino. Use
            fully-qualified names: <code>catalog.schema.table</code>
          </DialogDescription>
        </DialogHeader>

        {/* Category Filter */}
        <div className="flex space-x-2 mb-4">
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={filterCategory === cat ? "default" : "outline"}
              onClick={() => setFilterCategory(cat)}
              className={
                filterCategory === cat
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "border-gray-700 text-gray-300 hover:bg-gray-800"
              }
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Templates List */}
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {filteredTemplates.map((template, index) => (
              <div
                key={index}
                className="border border-gray-700 rounded-lg p-4 bg-gray-800/50 hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">
                      {getCategoryIcon(template.category)}
                    </span>
                    <div>
                      <h3 className="text-white font-medium">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant="outline"
                      className={getDifficultyColor(template.difficulty)}
                    >
                      {template.difficulty}
                    </Badge>
                  </div>
                </div>

                {/* Query Code Block */}
                <div className="relative">
                  <pre className="bg-gray-950 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                    {template.query}
                  </pre>
                  <div className="absolute top-2 right-2 flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(template.query, index)}
                      className="h-7 bg-gray-800 hover:bg-gray-700"
                    >
                      {copiedIndex === index ? (
                        <CheckCircle className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={() => onTemplateSelect(template.query)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Use This Query
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Help Section */}
        <div className="mt-4 p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg">
          <div className="flex items-start space-x-2">
            <Database className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-200">
              <p className="font-medium mb-1">💡 Federation Tips:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>
                  Use <code>SHOW CATALOGS</code> to see available databases
                </li>
                <li>
                  Always use format: <code>catalog.schema.table</code>
                </li>
                <li>
                  Example: <code>mysql.sales.orders</code>,{" "}
                  <code>postgresql.analytics.metrics</code>
                </li>
                <li>
                  Federated joins work across any catalogs (MySQL ↔ PostgreSQL)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
