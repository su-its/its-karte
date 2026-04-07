"use client";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { KarteTable } from "@/widgets/karte-table";
import type { KarteTableRow } from "@/widgets/karte-table";
import { AlertCircleIcon, CheckCircle2Icon, ArrowRightIcon, UploadIcon } from "lucide-react";
import { AssigneeMapper } from "./assignee-mapper";
import type { MemberInfo } from "../model/helpers";

export function ValidationStep({
  tableRows,
  errorCount,
  validCount,
  hasDuplicates,
  unresolvedAssignees,
  members,
  onStartErrorFlow,
  onExportAndProceed,
  onProceed,
  onRowClick,
  onResolveAssignee,
}: {
  tableRows: KarteTableRow[];
  errorCount: number;
  validCount: number;
  hasDuplicates: boolean;
  unresolvedAssignees: Map<string, number>;
  members: MemberInfo[];
  onStartErrorFlow: () => void;
  onExportAndProceed: () => void;
  onProceed: () => void;
  onRowClick: (karte: KarteTableRow, index: number) => void;
  onResolveAssignee: (name: string, memberId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {errorCount > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircleIcon className="size-5 text-destructive shrink-0" />
            <div>
              <p className="font-semibold">{errorCount}件のデータにエラーがあります</p>
              <p className="text-sm text-muted-foreground">
                赤くハイライトされた行をクリックして修正してください。すべて解決すると次に進めます。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-sm">
              <Badge variant="secondary">{validCount}件 正常</Badge>
              <Badge variant="destructive">{errorCount}件 エラー</Badge>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button size="lg" onClick={onStartErrorFlow}>
                エラーを修正する（残り{errorCount}件）
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                onClick={onExportAndProceed}
              >
                エラー行をCSV出力して正常行だけで進む
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2Icon className="size-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold">全{validCount}件のデータが正常です</p>
              <p className="text-sm text-muted-foreground">
                問題なければ次のステップへ進んでください。
              </p>
            </div>
          </div>
          <Button size="lg" onClick={onProceed}>
            {hasDuplicates ? (
              <>
                重複確認へ進む <ArrowRightIcon data-icon="inline-end" />
              </>
            ) : (
              <>
                <UploadIcon data-icon="inline-start" /> {validCount}件をインポート
              </>
            )}
          </Button>
        </div>
      )}

      {errorCount === 0 && unresolvedAssignees.size > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircleIcon className="size-5 text-yellow-600 shrink-0" />
            <div>
              <p className="font-semibold">
                {unresolvedAssignees.size}名の担当者がメンバーに紐づいていません
              </p>
              <p className="text-sm text-muted-foreground">
                メンバーを選択して紐づけるか、そのままインポートできます。
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[...unresolvedAssignees.entries()].map(([name, count]) => (
              <AssigneeMapper
                key={name}
                unresolvedName={name}
                count={count}
                members={members}
                onResolve={(memberId) => onResolveAssignee(name, memberId)}
              />
            ))}
          </div>
        </div>
      )}

      <KarteTable kartes={tableRows} onRowClick={onRowClick} />
    </div>
  );
}
