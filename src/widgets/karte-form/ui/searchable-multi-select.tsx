"use client";

import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { FieldLabel } from "@/shared/ui/field";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/ui/hover-card";
import { cn } from "@/shared/lib";

export type MultiSelectItem = {
  id: string;
  label: string;
  searchText: string;
  hoverDetail?: React.ReactNode;
};

export function SearchableMultiSelect({
  label,
  items,
  selected,
  onToggle,
  placeholder,
  readOnly = false,
  extraReadOnlyLabels = [],
}: {
  label: string;
  items: MultiSelectItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  placeholder: string;
  readOnly?: boolean;
  extraReadOnlyLabels?: string[];
}) {
  const [query, setQuery] = useState("");
  const lowerQuery = query.toLowerCase();
  const filtered = lowerQuery
    ? items.filter((item) => item.searchText.toLowerCase().includes(lowerQuery))
    : items;

  const selectedItems = items.filter((item) => selected.has(item.id));

  if (readOnly) {
    const hasAny = selectedItems.length > 0 || extraReadOnlyLabels.length > 0;
    return (
      <div className="mb-4">
        <div className="mb-2">
          <FieldLabel>{label}</FieldLabel>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hasAny ? (
            <>
              {selectedItems.map((item) => (
                <Badge key={item.id} variant="secondary">
                  {item.label}
                </Badge>
              ))}
              {extraReadOnlyLabels.map((name) => (
                <Badge key={name} variant="outline" className="text-muted-foreground">
                  {name}
                </Badge>
              ))}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {label && (
        <div className="mb-2">
          <FieldLabel>{label}</FieldLabel>
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedItems.map((item) => {
            const badge = (
              <Badge
                key={item.id}
                variant="default"
                className="cursor-pointer select-none"
                onClick={() => onToggle(item.id)}
              >
                {item.label} ×
              </Badge>
            );
            if (!item.hoverDetail) return badge;
            return (
              <HoverCard key={item.id}>
                <HoverCardTrigger>{badge}</HoverCardTrigger>
                <HoverCardContent>{item.hoverDetail}</HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      )}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="mb-2"
      />

      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {filtered.map((item) => {
          const isSelected = selected.has(item.id);
          const badge = (
            <Badge
              key={item.id}
              variant={isSelected ? "secondary" : "outline"}
              className={cn(
                "cursor-pointer select-none transition-colors",
                isSelected && "opacity-50",
              )}
              onClick={() => onToggle(item.id)}
            >
              {item.label}
            </Badge>
          );
          if (!item.hoverDetail) return badge;
          return (
            <HoverCard key={item.id}>
              <HoverCardTrigger>{badge}</HoverCardTrigger>
              <HoverCardContent>{item.hoverDetail}</HoverCardContent>
            </HoverCard>
          );
        })}
        {filtered.length === 0 && (
          <span className="text-sm text-muted-foreground">一致する項目がありません</span>
        )}
      </div>
    </div>
  );
}
