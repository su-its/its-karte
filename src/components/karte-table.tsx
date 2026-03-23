"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { CheckIcon, XIcon, ColumnsIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsultedAtPrecision, MemberOption } from "@/components/karte-form";
import { formatConsultedAtDisplay } from "@/components/karte-form";

type Recorded<T> = { type: "recorded"; value: T } | { type: "notRecorded" };

export type SerializedConsultedAt = {
  precision: ConsultedAtPrecision;
  value: string;
};

/** SerializedConsultedAtからYYYY-MM-DD形式の文字列を取得（フィルター用） */
function consultedAtToDateString(ca: SerializedConsultedAt): string {
  switch (ca.precision) {
    case "year":
      return `${ca.value}-01-01`;
    case "yearMonth":
      return `${ca.value}-01`;
    case "date":
    case "datetime":
      return ca.value.slice(0, 10);
  }
}

export type KarteTableRow = {
  id: string;
  recordedAt: string;
  consultedAt: Recorded<SerializedConsultedAt>;
  client: Recorded<{
    type: string;
    name: string;
    studentId?: string;
    affiliation?: string;
    affiliationData?: {
      courseType: "undergraduate" | "master" | "doctoral" | "professional";
      faculty: string;
      department: string;
      year: number | null;
    };
  }>;
  consent: {
    liabilityConsent: boolean;
    disclosureConsent: boolean;
  };
  consultation: {
    targetDevice: Recorded<string>;
    categories: Recorded<readonly { id: string; displayName: string }[]>;
    troubleDetails: Recorded<string>;
  };
  assignedMemberNames: string[];
  supportRecord: {
    content: Recorded<string>;
    resolution: Recorded<{ type: "resolved" } | { type: "unresolved"; followUp?: string }>;
    workDuration: Recorded<number>;
  };
  /** エラーメッセージ（設定されている行はエラー行として扱う） */
  error?: string;
  /** エラーが修正済みであることを示す */
  fixed?: boolean;
  /** 警告（非ブロッキング: 未解決担当者など） */
  warning?: string;
};

const COLUMNS = [
  { key: "id", label: "ID", defaultVisible: false },
  { key: "recordedAt", label: "記録日時", defaultVisible: true },
  { key: "consultedAt", label: "相談日時", defaultVisible: true },
  { key: "client", label: "相談者", defaultVisible: true },
  { key: "consent", label: "同意", defaultVisible: false },
  { key: "targetDevice", label: "対象端末", defaultVisible: true },
  { key: "categories", label: "カテゴリ", defaultVisible: true },
  { key: "troubleDetails", label: "トラブル詳細", defaultVisible: true },
  { key: "supportContent", label: "対応内容", defaultVisible: true },
  { key: "assignee", label: "担当者", defaultVisible: true },
  { key: "resolution", label: "ステータス", defaultVisible: true },
  { key: "workDuration", label: "作業時間", defaultVisible: false },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDatePresets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const today = toDateString(now);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fiscalYearStart = new Date(fiscalYear, 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  return [
    { label: "今日", from: today, to: today },
    { label: "今週", from: toDateString(weekStart), to: today },
    { label: "今月", from: toDateString(monthStart), to: today },
    { label: "今年度", from: toDateString(fiscalYearStart), to: today },
    { label: "今年", from: toDateString(yearStart), to: today },
  ];
}

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientTypeFilter, setClientTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const isVisible = (key: ColumnKey) => visibleColumns.has(key);
  const visibleCount = visibleColumns.size;

  const hasActiveFilters =
    search || statusFilter !== "all" || clientTypeFilter !== "all" || dateFrom || dateTo;

  const filtered = kartes.filter((karte) => {
    // Status
    if (statusFilter !== "all") {
      const res = karte.supportRecord.resolution;
      if (
        statusFilter === "resolved" &&
        !(res.type === "recorded" && res.value.type === "resolved")
      )
        return false;
      if (
        statusFilter === "unresolved" &&
        !(res.type === "recorded" && res.value.type === "unresolved")
      )
        return false;
      if (statusFilter === "notRecorded" && res.type !== "notRecorded") return false;
    }
    // Client type
    if (clientTypeFilter !== "all") {
      const type = karte.client.type === "recorded" ? karte.client.value.type : "";
      if (type !== clientTypeFilter) return false;
    }
    // Date range
    if (dateFrom || dateTo) {
      const date =
        karte.consultedAt.type === "recorded"
          ? consultedAtToDateString(karte.consultedAt.value)
          : karte.recordedAt.slice(0, 10);
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
    }
    // Text search
    if (search) {
      const q = search.toLowerCase();
      const texts = [
        karte.client.type === "recorded" ? karte.client.value.name : "",
        karte.client.type === "recorded" ? (karte.client.value.studentId ?? "") : "",
        karte.consultation.troubleDetails.type === "recorded"
          ? karte.consultation.troubleDetails.value
          : "",
        karte.supportRecord.content.type === "recorded" ? karte.supportRecord.content.value : "",
        ...karte.assignedMemberNames,
        karte.consultation.targetDevice.type === "recorded"
          ? karte.consultation.targetDevice.value
          : "",
      ];
      if (!texts.some((t) => t.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setClientTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前・学籍番号・内容で検索..."
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              if (v) setStatusFilter(v);
            }}
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
            value={clientTypeFilter}
            onValueChange={(v) => {
              if (v) setClientTypeFilter(v);
            }}
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
                variant={dateFrom === p.from && dateTo === p.to ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  if (dateFrom === p.from && dateTo === p.to) {
                    setDateFrom("");
                    setDateTo("");
                  } else {
                    setDateFrom(p.from);
                    setDateTo(p.to);
                  }
                }}
              >
                {p.label}
              </Button>
            ))}
            <span className="text-muted-foreground text-xs mx-1">|</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-34 h-8 text-xs"
            />
            <span className="text-muted-foreground text-xs">〜</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
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
              <TableHead className="whitespace-nowrap">対象端末</TableHead>
            )}
            {isVisible("categories") && (
              <TableHead className="whitespace-nowrap">カテゴリ</TableHead>
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
                            <span className="cursor-default">{karte.client.value.name}</span>
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
                    <TableCell className="text-sm">
                      {karte.consultation.targetDevice.type === "recorded" ? (
                        karte.consultation.targetDevice.value
                      ) : (
                        <NotRecorded />
                      )}
                    </TableCell>
                  )}
                  {isVisible("categories") && (
                    <TableCell className="text-sm">
                      {karte.consultation.categories.type === "recorded" ? (
                        <div className="flex flex-wrap gap-1">
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
