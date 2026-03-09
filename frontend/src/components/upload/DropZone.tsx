import { Upload, FileText, AlertCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
}

export default function DropZone({ onFileSelected, disabled, error }: DropZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
          isDragActive && "border-primary bg-primary/5",
          isDragReject && "border-destructive bg-destructive/5",
          !isDragActive && !isDragReject && "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed",
          selectedFile && !isDragActive && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
        )}
      >
        <input {...getInputProps()} />

        {selectedFile ? (
          <>
            <FileText className="h-10 w-10 text-green-600 mb-3" />
            <p className="font-medium text-sm">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click or drag to replace
            </p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-sm">
              {isDragActive ? "Drop your PDF here" : "Drag & drop your PDF contract"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse · PDF only · max 50 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
