"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import Monaco to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-950 rounded-lg">
      <div className="text-center text-white">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-400">Loading editor...</p>
      </div>
    </div>
  ),
  ssr: false,
});

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  dialect: string;
  schema?: {
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
      }>;
    }>;
  };
}

export function MonacoEditor({
  value,
  onChange,
  dialect,
  schema,
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Configure SQL language support
    monaco.languages.setLanguageConfiguration("sql", {
      comments: {
        lineComment: "--",
        blockComment: ["/*", "*/"],
      },
      brackets: [
        ["(", ")"],
        ["[", "]"],
      ],
      autoClosingPairs: [
        { open: "(", close: ")" },
        { open: "[", close: "]" },
        { open: "'", close: "'" },
        { open: '"', close: '"' },
      ],
    });

    // Set up auto-completion
    if (schema?.tables) {
      const tableNames = schema.tables.map((table) => table.name);
      const columnNames = schema.tables.flatMap((table) =>
        table.columns.map((col) => `${table.name}.${col.name}`)
      );

      monaco.languages.registerCompletionItemProvider("sql", {
        provideCompletionItems: (model: any, position: any) => {
          const suggestions = [
            // SQL Keywords
            ...[
              "SELECT",
              "FROM",
              "WHERE",
              "INSERT",
              "UPDATE",
              "DELETE",
              "CREATE",
              "DROP",
              "ALTER",
              "JOIN",
              "INNER",
              "LEFT",
              "RIGHT",
              "OUTER",
              "ON",
              "GROUP BY",
              "ORDER BY",
              "HAVING",
              "LIMIT",
              "OFFSET",
            ].map((keyword) => ({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              detail: "SQL Keyword",
            })),
            // Table names
            ...tableNames.map((table) => ({
              label: table,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table,
              detail: "Table",
            })),
            // Column names
            ...columnNames.map((column) => ({
              label: column,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: column,
              detail: "Column",
            })),
          ];

          return { suggestions };
        },
      });
    }

    // Set editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
    });

    // Add keyboard shortcuts
    editor.addAction({
      id: "execute-query",
      label: "Execute Query",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        // This will be handled by the parent component
        console.log("Execute query shortcut pressed");
      },
    });

    // Format query shortcut
    editor.addAction({
      id: "format-query",
      label: "Format Query",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      ],
      run: () => {
        editor.getAction("editor.action.formatDocument").run();
      },
    });
  };

  const getLanguageForDialect = (dialect: string) => {
    switch (dialect) {
      case "mysql":
      case "postgresql":
      case "trino":
      case "spark":
        return "sql";
      default:
        return "sql";
    }
  };

  const getTheme = (dialect: string) => {
    // You can customize themes per dialect if needed
    return "vs-dark";
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={getLanguageForDialect(dialect)}
        theme={getTheme(dialect)}
        value={value}
        onChange={(value) => onChange(value || "")}
        onMount={handleEditorDidMount}
        options={{
          selectOnLineNumbers: true,
          automaticLayout: true,
          fontSize: 14,
          lineHeight: 20,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          insertSpaces: true,
          renderLineHighlight: "all",
          smoothScrolling: true,
          cursorBlinking: "smooth",
          folding: true,
          lineNumbers: "on",
          glyphMargin: false,
          padding: { top: 16, bottom: 16 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          parameterHints: {
            enabled: true,
          },
        }}
      />
    </div>
  );
}
