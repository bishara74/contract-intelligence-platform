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
    <div className="space-y-3 w-full overflow-hidden">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDragActive && "border-ink bg-highlight/30",
          isDragReject && "border-destructive bg-destructive/5",
          !isDragActive && !isDragReject && "border-input hover:border-ink/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed",
          selectedFile && !isDragActive && "border-solid border-ink/40 bg-muted/40"
        )}
      >
        <input {...getInputProps()} />

        {selectedFile ? (
          <div className="max-w-full w-full overflow-hidden flex flex-col items-center">
            <FileText className="mb-3 h-9 w-9 text-ink" aria-hidden />
            <p className="max-w-full truncate px-2 text-sm font-bold text-ink" title={selectedFile.name}>
              {selectedFile.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB. Click or drop another file to replace it.
            </p>
          </div>
        ) : (
          <>
            <Upload className="mb-3 h-9 w-9 text-ink" aria-hidden />
            <p className="text-sm font-bold text-ink">
              {isDragActive ? "Drop the PDF to select it" : "Drop a PDF here or click to choose one"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">PDF only, up to 50 MB</p>
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
