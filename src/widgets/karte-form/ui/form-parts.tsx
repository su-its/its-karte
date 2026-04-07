"use client";

import { Badge } from "@/shared/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/ui/hover-card";
import { FieldLabel } from "@/shared/ui/field";
import { Separator } from "@/shared/ui/separator";
import type { MemberOption } from "@/shared/api";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <Separator className="mb-4" />
      {children}
    </div>
  );
}

export function AssigneeReadOnly({
  members,
  selectedIds,
  unresolvedNames,
}: {
  members: MemberOption[];
  selectedIds: Set<string>;
  unresolvedNames: string[];
}) {
  const resolvedMembers = members.filter((m) => selectedIds.has(m.id));
  const hasAny = resolvedMembers.length > 0 || unresolvedNames.length > 0;

  return (
    <div className="mb-4">
      <div className="mb-2">
        <FieldLabel>担当者</FieldLabel>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hasAny ? (
          <>
            {resolvedMembers.map((m) => (
              <HoverCard key={m.id}>
                <HoverCardTrigger>
                  <Badge variant="secondary" className="cursor-default">
                    {m.name}
                  </Badge>
                </HoverCardTrigger>
                <HoverCardContent>
                  <MemberHoverContent member={m} />
                </HoverCardContent>
              </HoverCard>
            ))}
            {unresolvedNames.map((name) => (
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

export function MemberHoverContent({ member }: { member: MemberOption }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-semibold">{member.name}</p>
      {member.studentId && (
        <div className="text-xs text-muted-foreground font-mono">{member.studentId}</div>
      )}
      {member.department && (
        <div className="text-xs text-muted-foreground">{member.department}</div>
      )}
      {member.email && <div className="text-xs text-muted-foreground">{member.email}</div>}
    </div>
  );
}
