"use client";

import React from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AlertCircleIcon, UploadIcon, ArrowLeftIcon } from "lucide-react";
import { cn } from "@/shared/lib";
import { DupCell } from "./dup-cell";
import type { CsvRow } from "../model/parse-csv";
import type { DuplicateMatch } from "../model/helpers";

export function DuplicateStep({
  rows,
  duplicateMap,
  skippedIndices,
  expandedDuplicates,
  importableCount,
  onToggleSkip,
  onExpandDuplicates,
  onBack,
  onImport,
}: {
  rows: CsvRow[];
  duplicateMap: Map<number, DuplicateMatch[]>;
  skippedIndices: Set<number>;
  expandedDuplicates: Set<number>;
  importableCount: number;
  onToggleSkip: (index: number) => void;
  onExpandDuplicates: (index: number) => void;
  onBack: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircleIcon className="size-5 text-yellow-600 shrink-0" />
          <div>
            <p className="font-semibold">{duplicateMap.size}件の重複候補が見つかりました</p>
            <p className="text-sm text-muted-foreground">
              CSVデータと既存レコードを比較して、インポートするかスキップするか判断してください。
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <Badge variant="secondary">{importableCount}件 インポート</Badge>
          <Badge variant="outline">{skippedIndices.size}件 スキップ</Badge>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ソース</TableHead>
            <TableHead className="whitespace-nowrap">相談日</TableHead>
            <TableHead className="whitespace-nowrap">相談者</TableHead>
            <TableHead>トラブル詳細</TableHead>
            <TableHead>対応内容</TableHead>
            <TableHead className="whitespace-nowrap">担当者</TableHead>
            <TableHead className="w-28">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...duplicateMap.entries()].map(([csvIndex, matches]) => {
            const row = rows[csvIndex];
            const isSkipped = skippedIndices.has(csvIndex);
            const topMatchFields = new Set(matches.flatMap((m) => m.matchedFields));
            const visibleMatches = expandedDuplicates.has(csvIndex) ? matches : matches.slice(0, 2);
            const hasMore = matches.length > 2 && !expandedDuplicates.has(csvIndex);

            return (
              <React.Fragment key={csvIndex}>
                <TableRow className={cn("border-b-0", isSkipped ? "opacity-50" : "bg-background")}>
                  <TableCell className="text-xs font-semibold">CSV 行{csvIndex + 2}</TableCell>
                  <DupCell value={row.date} highlight={topMatchFields.has("nameDate")} />
                  <DupCell value={row.name} highlight={topMatchFields.has("nameDate")} />
                  <DupCell
                    value={row.troubleDetails}
                    highlight={topMatchFields.has("trouble")}
                    truncate
                  />
                  <DupCell
                    value={row.supportContent}
                    highlight={topMatchFields.has("support")}
                    truncate
                  />
                  <TableCell className="text-sm">{row.assignee}</TableCell>
                  <TableCell>
                    <Button
                      variant={isSkipped ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => onToggleSkip(csvIndex)}
                    >
                      {isSkipped ? "インポート" : "スキップ"}
                    </Button>
                  </TableCell>
                </TableRow>
                {visibleMatches.map((match) => {
                  const k = match.existingKarte;
                  const mf = new Set(match.matchedFields);
                  const clientName = k.client.type === "recorded" ? k.client.value.name : "";
                  const date = k.consultedAt.type === "recorded" ? k.consultedAt.value.value : "";
                  const troubleDetails =
                    k.consultation.troubleDetails.type === "recorded"
                      ? k.consultation.troubleDetails.value
                      : "";
                  const content =
                    k.supportRecord.content.type === "recorded"
                      ? k.supportRecord.content.value
                      : "";
                  return (
                    <TableRow key={k.id} className="bg-muted/30 border-b-0">
                      <TableCell className="text-xs text-muted-foreground">既存</TableCell>
                      <DupCell value={date} highlight={mf.has("nameDate")} />
                      <DupCell value={clientName} highlight={mf.has("nameDate")} />
                      <DupCell value={troubleDetails} highlight={mf.has("trouble")} truncate />
                      <DupCell value={content} highlight={mf.has("support")} truncate />
                      <TableCell className="text-sm">{k.assignedMemberNames.join(", ")}</TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })}
                {hasMore && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={7} className="text-center">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                        onClick={() => onExpandDuplicates(csvIndex)}
                      >
                        他{matches.length - 2}件の候補を表示
                      </button>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="h-2 border-b">
                  <TableCell colSpan={7} className="p-0" />
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" /> データ検証に戻る
        </Button>
        <Button size="lg" onClick={onImport}>
          <UploadIcon data-icon="inline-start" /> {importableCount}件をインポート
        </Button>
      </div>
    </div>
  );
}
