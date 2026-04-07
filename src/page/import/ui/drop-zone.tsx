"use client";

import { useState, useRef } from "react";
import { UploadIcon } from "lucide-react";
import { cn } from "@/shared/lib";

export function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) onFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center py-24 gap-4 cursor-pointer rounded-xl border-2 border-dashed transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <UploadIcon className={cn("size-12", dragging ? "text-primary" : "text-muted-foreground")} />
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-1">
          {dragging ? "ここにドロップ" : "CSVファイルをドラッグ＆ドロップ"}
        </h2>
        <p className="text-muted-foreground">またはクリックしてファイルを選択</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
