"use client";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib";

export type ComparisonRow = {
  label: string;
  csvValue: string;
  dbValue: string;
  isMatchKey: boolean;
};

const MATCH_FIELD_LABELS: Record<string, string> = {
  nameDate: "氏名＋日付",
  trouble: "トラブル詳細",
  support: "対応内容",
};

export function DuplicateComparison({
  fields,
  matchedFieldKeys,
}: {
  fields: ComparisonRow[];
  matchedFieldKeys: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">一致項目:</span>
        {matchedFieldKeys.map((key) => (
          <Badge key={key} variant="secondary">
            {MATCH_FIELD_LABELS[key] ?? key}
          </Badge>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 w-28 font-medium">項目</th>
              <th className="text-left p-3 font-medium">CSVデータ</th>
              <th className="text-left p-3 font-medium">既存レコード</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr
                key={field.label}
                className={cn(
                  "border-b last:border-b-0",
                  field.isMatchKey && "bg-yellow-50 dark:bg-yellow-950/20",
                )}
              >
                <td className="p-3 text-muted-foreground font-medium whitespace-nowrap">
                  {field.label}
                  {field.isMatchKey && <span className="text-yellow-600 ml-1">●</span>}
                </td>
                <td className="p-3 whitespace-pre-wrap break-words max-w-[300px]">
                  {field.csvValue || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 whitespace-pre-wrap break-words max-w-[300px]">
                  {field.dbValue || <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
