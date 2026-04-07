"use client";

import { Input } from "@/shared/ui/input";
import type { ConsultedAtPrecision } from "@/shared/api";

export function ConsultedAtInput({
  precision,
  value,
  onChange,
  className,
}: {
  precision: ConsultedAtPrecision;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  switch (precision) {
    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "yearMonth":
      return (
        <Input
          type="month"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "year":
      return (
        <Input
          type="number"
          min={2000}
          max={2099}
          placeholder="例: 2025"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
  }
}
