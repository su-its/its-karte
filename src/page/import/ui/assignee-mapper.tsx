"use client";

import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/ui/hover-card";
import { ArrowRightIcon } from "lucide-react";
import type { MemberInfo } from "../model/helpers";

export function AssigneeMapper({
  unresolvedName,
  count,
  members,
  onResolve,
}: {
  unresolvedName: string;
  count: number;
  members: MemberInfo[];
  onResolve: (memberId: string) => void;
}) {
  const [query, setQuery] = useState(unresolvedName);
  const [resolved, setResolved] = useState<MemberInfo | null>(null);
  const lowerQuery = query.toLowerCase();
  const filtered = lowerQuery
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(lowerQuery) ||
          (m.studentId ?? "").toLowerCase().includes(lowerQuery),
      )
    : members;

  if (resolved) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-background p-3">
        <Badge variant="outline" className="text-muted-foreground shrink-0">
          {unresolvedName}
        </Badge>
        <ArrowRightIcon className="size-4 text-muted-foreground shrink-0" />
        <Badge variant="default">{resolved.name}</Badge>
        <span className="text-xs text-muted-foreground">({count}件)</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-3 mb-2">
        <Badge variant="outline" className="text-muted-foreground shrink-0">
          {unresolvedName}
        </Badge>
        <span className="text-xs text-muted-foreground shrink-0">({count}件)</span>
        <ArrowRightIcon className="size-4 text-muted-foreground shrink-0" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・学籍番号で検索..."
          className="h-8 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {filtered.map((m) => (
          <HoverCard key={m.id}>
            <HoverCardTrigger>
              <Badge
                variant="outline"
                className="cursor-pointer select-none hover:bg-muted transition-colors"
                onClick={() => {
                  setResolved(m);
                  onResolve(m.id);
                }}
              >
                {m.name}
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="text-sm">
              <div className="flex flex-col gap-1">
                <div className="font-semibold">{m.name}</div>
                {m.studentId && <div className="text-muted-foreground">{m.studentId}</div>}
                {m.department && <div className="text-muted-foreground">{m.department}</div>}
              </div>
            </HoverCardContent>
          </HoverCard>
        ))}
        {filtered.length === 0 && (
          <span className="text-sm text-muted-foreground py-1">該当なし</span>
        )}
      </div>
    </div>
  );
}
