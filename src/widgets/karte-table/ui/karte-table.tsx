"use client";

import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/ui/hover-card";
import { CheckIcon, XIcon, ColumnsIcon, SearchIcon } from "lucide-react";
import { cn } from "@/shared/lib";
import type { MemberOption } from "@/shared/api";
import { formatConsultedAtDisplay } from "@/shared/lib";

import {
  type KarteTableRow,
  type ColumnKey,
  type FilterState,
  COLUMNS,
  getDatePresets,
  filterKartes,
} from "../model/karte-table-columns";

export type { KarteTableRow, SerializedConsultedAt } from "../model/karte-table-columns";

const DATE_PRESETS = getDatePresets();

function NotRecorded() {
  return <span className="text-muted-foreground">未記録</span>;
}

function ConsentIcon({ consented }: { consented: boolean }) {
  return consented ? (
    <CheckIcon className="text-green-600 size-4" />
  ) : (
    <XIcon className="text-muted-foreground size-4" />
  );
}

export function KarteTable({
  kartes,
  members = [],
  emptyMessage = "条件に一致するカルテデータが見つかりません",
  onRowClick,
}: {
  kartes: KarteTableRow[];
  members?: MemberOption[];
  emptyMessage?: string;
  onRowClick?: (karte: KarteTableRow, index: number) => void;
}) {
  const memberByName = new Map(members.map((m) => [m.name, m]));
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)),
  );
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    statusFilter: "all",
    clientTypeFilter: "all",
    dateFrom: "",
    dateTo: "",
  });

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isVisible = (key: ColumnKey) => visibleColumns.has(key);
  const visibleCount = visibleColumns.size;

  const hasActiveFilters =
    filters.search ||
    filters.statusFilter !== "all" ||
    filters.clientTypeFilter !== "all" ||
    filters.dateFrom ||
    filters.dateTo;

  const filtered = filterKartes(kartes, filters);

  function clearFilters() {
    setFilters({
      search: "",
      statusFilter: "all",
      clientTypeFilter: "all",
      dateFrom: "",
      dateTo: "",
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="名前・学籍番号・内容で検索..."
              className="pl-9"
            />
          </div>
          <Select
            value={filters.statusFilter}
            onValueChange={(v) => v && setFilter("statusFilter", v)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ステータス</SelectItem>
              <SelectItem value="resolved">解決</SelectItem>
              <SelectItem value="unresolved">未解決</SelectItem>
              <SelectItem value="notRecorded">未記録</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.clientTypeFilter}
            onValueChange={(v) => v && setFilter("clientTypeFilter", v)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">相談者種別</SelectItem>
              <SelectItem value="学生">学生</SelectItem>
              <SelectItem value="教員">教員</SelectItem>
              <SelectItem value="職員">職員</SelectItem>
              <SelectItem value="その他">その他</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant={
                  filters.dateFrom === p.from && filters.dateTo === p.to ? "secondary" : "ghost"
                }
                size="sm"
                onClick={() => {
                  if (filters.dateFrom === p.from && filters.dateTo === p.to) {
                    setFilters((prev) => ({ ...prev, dateFrom: "", dateTo: "" }));
                  } else {
                    setFilters((prev) => ({ ...prev, dateFrom: p.from, dateTo: p.to }));
                  }
                }}
              >
                {p.label}
              </Button>
            ))}
            <span className="text-muted-foreground text-xs mx-1">|</span>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter("dateFrom", e.target.value)}
              className="w-34 h-8 text-xs"
            />
            <span className="text-muted-foreground text-xs">〜</span>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter("dateTo", e.target.value)}
              className="w-34 h-8 text-xs"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              クリア
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <ColumnsIcon data-icon="inline-start" />
                  列の表示
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={isVisible(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {isVisible("id") && <TableHead className="whitespace-nowrap">ID</TableHead>}
            {isVisible("recordedAt") && (
              <TableHead className="whitespace-nowrap">記録日時</TableHead>
            )}
            {isVisible("consultedAt") && (
              <TableHead className="whitespace-nowrap">相談日時</TableHead>
            )}
            {isVisible("client") && <TableHead className="whitespace-nowrap">相談者</TableHead>}
            {isVisible("consent") && (
              <>
                <TableHead className="whitespace-nowrap">免責</TableHead>
                <TableHead className="whitespace-nowrap">公開</TableHead>
              </>
            )}
            {isVisible("targetDevice") && (
              <TableHead className="whitespace-nowrap max-w-32">対象端末</TableHead>
            )}
            {isVisible("categories") && (
              <TableHead className="whitespace-nowrap max-w-48">カテゴリ</TableHead>
            )}
            {isVisible("troubleDetails") && (
              <TableHead className="whitespace-nowrap">トラブル詳細</TableHead>
            )}
            {isVisible("supportContent") && (
              <TableHead className="whitespace-nowrap">対応内容</TableHead>
            )}
            {isVisible("assignee") && <TableHead className="whitespace-nowrap">担当者</TableHead>}
            {isVisible("resolution") && (
              <TableHead className="whitespace-nowrap">ステータス</TableHead>
            )}
            {isVisible("workDuration") && (
              <TableHead className="whitespace-nowrap">作業時間</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleCount + (isVisible("consent") ? 1 : 0)}
                className="h-32 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((karte) => {
              const originalIndex = kartes.indexOf(karte);
              return (
                <TableRow
                  key={karte.id}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    karte.error && "bg-destructive/5 hover:bg-destructive/10",
                    karte.fixed && !karte.error && "bg-green-500/5 hover:bg-green-500/10",
                    !karte.error && karte.warning && "bg-yellow-500/5 hover:bg-yellow-500/10",
                  )}
                  onClick={() => onRowClick?.(karte, originalIndex)}
                >
                  {isVisible("id") && (
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {karte.id.slice(0, 8)}
                    </TableCell>
                  )}
                  {isVisible("recordedAt") && (
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(karte.recordedAt).toLocaleString("ja-JP")}
                    </TableCell>
                  )}
                  {isVisible("consultedAt") && (
                    <TableCell className="whitespace-nowrap text-sm">
                      {karte.consultedAt.type === "recorded" ? (
                        formatConsultedAtDisplay(
                          karte.consultedAt.value.precision,
                          karte.consultedAt.value.value,
                        )
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("client") && (
                    <TableCell className="text-sm">
                      {karte.client.type === "recorded" ? (
                        <HoverCard>
                          <HoverCardTrigger>
                            <span className="cursor-default">
                              {karte.client.value.name || karte.client.value.studentId || "—"}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent>
                            <div className="flex flex-col gap-1.5">
                              <p className="font-semibold">{karte.client.value.name}</p>
                              <Badge variant="outline" className="w-fit text-xs">
                                {karte.client.value.type}
                              </Badge>
                              {karte.client.value.studentId && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {karte.client.value.studentId}
                                </div>
                              )}
                              {karte.client.value.affiliation && (
                                <div className="text-xs text-muted-foreground">
                                  {karte.client.value.affiliation}
                                </div>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("consent") && (
                    <>
                      <TableCell className="text-center">
                        <ConsentIcon consented={karte.consent.liabilityConsent} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ConsentIcon consented={karte.consent.disclosureConsent} />
                      </TableCell>
                    </>
                  )}
                  {isVisible("targetDevice") && (
                    <TableCell className="text-sm max-w-32 truncate">
                      {karte.consultation.targetDevice.type === "recorded" ? (
                        karte.consultation.targetDevice.value
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("categories") && (
                    <TableCell className="text-sm max-w-48">
                      {karte.consultation.categories.type === "recorded" ? (
                        <div className="flex gap-1 overflow-hidden">
                          {karte.consultation.categories.value.map((cat) => (
                            <Badge key={cat.id} variant="outline" className="text-xs">
                              {cat.displayName}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("troubleDetails") && (
                    <TableCell className="text-sm max-w-48">
                      {karte.consultation.troubleDetails.type === "recorded" ? (
                        <div className="truncate">{karte.consultation.troubleDetails.value}</div>
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("supportContent") && (
                    <TableCell className="text-sm max-w-48">
                      {karte.supportRecord.content.type === "recorded" ? (
                        <div className="truncate">{karte.supportRecord.content.value}</div>
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("assignee") && (
                    <TableCell className="text-sm">
                      {karte.assignedMemberNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {karte.assignedMemberNames.map((name) => {
                            const member = memberByName.get(name);
                            if (member) {
                              return (
                                <HoverCard key={name}>
                                  <HoverCardTrigger>
                                    <Badge variant="secondary" className="cursor-default text-xs">
                                      {name}
                                    </Badge>
                                  </HoverCardTrigger>
                                  <HoverCardContent>
                                    <div className="flex flex-col gap-1.5">
                                      <p className="font-semibold">{member.name}</p>
                                      {member.studentId && (
                                        <div className="text-xs text-muted-foreground font-mono">
                                          {member.studentId}
                                        </div>
                                      )}
                                      {member.department && (
                                        <div className="text-xs text-muted-foreground">
                                          {member.department}
                                        </div>
                                      )}
                                      {member.email && (
                                        <div className="text-xs text-muted-foreground">
                                          {member.email}
                                        </div>
                                      )}
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            }
                            return (
                              <Badge
                                key={name}
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
                                {name}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("resolution") && (
                    <TableCell>
                      {karte.supportRecord.resolution.type === "recorded" ? (
                        karte.supportRecord.resolution.value.type === "resolved" ? (
                          <Badge variant="secondary">解決</Badge>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="destructive">未解決</Badge>
                            {karte.supportRecord.resolution.value.followUp && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                → {karte.supportRecord.resolution.value.followUp}
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <Badge variant="outline">未記録</Badge>
                      )}
                    </TableCell>
                  )}
                  {isVisible("workDuration") && (
                    <TableCell className="text-sm text-right">
                      {karte.supportRecord.workDuration.type === "recorded" ? (
                        `${karte.supportRecord.workDuration.value}分`
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  {karte.error && (
                    <TableCell className="text-xs text-destructive">{karte.error}</TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
