"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2 } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";

interface CsvUploadProps {
  onUploadComplete: (
    tableName: string,
    columns: string[],
    schemaInvalidated?: boolean
  ) => void;
}

export function CsvUpload({ onUploadComplete }: CsvUploadProps) {
  const { currentProject } = useProject();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles]);
    setUploadError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
      "text/plain": [".csv"],
    },
    multiple: true,
  });

  const removeFile = (fileToRemove: File) => {
    setUploadedFiles((prev) => prev.filter((file) => file !== fileToRemove));
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("project_id", currentProject!.id);

        const response = await fetch("http://localhost:8000/upload-csv", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Upload failed");
        }

        const result = await response.json();

        // Show optimization message if present
        if (result.optimization_message) {
          console.log(`⚡ ${result.optimization_message}`);
        }

        // Enhanced success message with query tip
        console.log(
          `✅ ${file.name} uploaded successfully!
Table: ${result.table_name}
Rows: ${result.rows_loaded}
Engine: ${result.engine} → Query with: ${result.query_engine}
Size: ${result.file_size_mb} MB
${result.query_tip}${
            result.actual_engine
              ? `\nActual Engine: ${result.actual_engine.toUpperCase()}`
              : ""
          }`
        );

        // Notify parent component of successful upload
        // Pass schema_invalidated flag to trigger refresh
        onUploadComplete(
          result.table_name,
          result.columns,
          result.schema_invalidated
        );
      }

      // Clear uploaded files after successful upload
      setUploadedFiles([]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Show for all projects (backend will handle routing)
  if (!currentProject) {
    return null;
  }

  return (
    <div className="p-4 border-b border-gray-700">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-white mb-1">CSV Upload</h3>
        <p className="text-xs text-gray-400">
          Upload CSV files - auto-routed to optimal engine (PostgreSQL/Spark)
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-400 bg-blue-900/20"
            : "border-gray-600 hover:border-gray-500 hover:bg-gray-800/50"
        }`}
      >
        <input {...getInputProps()} />
        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        {isDragActive ? (
          <p className="text-sm text-blue-300">Drop CSV files here...</p>
        ) : (
          <div>
            <p className="text-sm text-gray-300 mb-1">
              Drag & drop CSV files or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Files will be uploaded as temporary tables
            </p>
          </div>
        )}
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700"
            >
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-4 w-4 text-green-400" />
                <div>
                  <p className="text-sm text-white truncate max-w-40">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(file)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <Button
            onClick={uploadFiles}
            disabled={isUploading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            size="sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {uploadedFiles.length} file
                {uploadedFiles.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-red-300">{uploadError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
