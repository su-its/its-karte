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
import { CheckIcon, XIcon, ColumnsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Recorded<T> = { type: "recorded"; value: T } | { type: "notRecorded" };

export type KarteTableRow = {
  id: string;
  recordedAt: string;
  consultedAt: Recorded<string>;
  client: Recorded<{
    type: string;
    name: string;
    studentId?: string;
    affiliation?: string;
    affiliationData?: {
      courseType: "undergraduate" | "master" | "doctoral" | "professional";
      faculty: string;
      department: string;
      year: number;
    };
  }>;
  consent: {
    liabilityConsent: boolean;
    disclosureConsent: boolean;
  };
  consultation: {
    targetDevice: Recorded<string>;
    categories: Recorded<readonly { id: string; displayName: string }[]>;
    troubleDetails: string;
  };
  assignedMemberNames: string[];
  supportRecord: {
    content: string;
    resolution: Recorded<{ type: "resolved" } | { type: "unresolved"; followUp?: string }>;
    workDuration: Recorded<number>;
  };
  /** エラーメッセージ（設定されている行はエラー行として扱う） */
  error?: string;
  /** エラーが修正済みであることを示す */
  fixed?: boolean;
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
  emptyMessage = "条件に一致するカルテデータが見つかりません",
  onRowClick,
}: {
  kartes: KarteTableRow[];
  emptyMessage?: string;
  onRowClick?: (karte: KarteTableRow, index: number) => void;
}) {
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)),
  );

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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
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
          {kartes.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleCount + (isVisible("consent") ? 1 : 0)}
                className="h-32 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            kartes.map((karte, index) => (
              <TableRow
                key={karte.id}
                className={cn(
                  onRowClick && "cursor-pointer",
                  karte.error && "bg-destructive/5 hover:bg-destructive/10",
                  karte.fixed && !karte.error && "bg-green-500/5 hover:bg-green-500/10",
                )}
                onClick={() => onRowClick?.(karte, index)}
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
                      new Date(karte.consultedAt.value).toLocaleString("ja-JP")
                    ) : (
                      <NotRecorded />
                    )}
                  </TableCell>
                )}
                {isVisible("client") && (
                  <TableCell className="text-sm">
                    {karte.client.type === "recorded" ? (
                      <div>
                        <div>{karte.client.value.name}</div>
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
                    <div className="truncate">{karte.consultation.troubleDetails}</div>
                  </TableCell>
                )}
                {isVisible("supportContent") && (
                  <TableCell className="text-sm max-w-48">
                    <div className="truncate">{karte.supportRecord.content}</div>
                  </TableCell>
                )}
                {isVisible("assignee") && (
                  <TableCell className="text-sm">
                    {karte.assignedMemberNames.length > 0 ? (
                      karte.assignedMemberNames.join(", ")
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
                        <div className="flex flex-col gap-1">
                          <Badge variant="destructive">未解決</Badge>
                          {karte.supportRecord.resolution.value.followUp && (
                            <span className="text-xs text-muted-foreground">
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
