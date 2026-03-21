import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type KarteTableRow = {
  id: string;
  recordedAt: string;
  consultedAt: { type: "recorded"; value: unknown } | { type: "notRecorded" };
  client: { type: "recorded"; value: { name: string } } | { type: "notRecorded" };
  consultation: {
    targetDevice: { type: "recorded"; value: string } | { type: "notRecorded" };
    categories:
      | {
          type: "recorded";
          value: readonly { id: string; displayName: string }[];
        }
      | { type: "notRecorded" };
    troubleDetails: string;
  };
  assignedMemberNames: string[];
  supportRecord: {
    resolution:
      | {
          type: "recorded";
          value: { type: "resolved" } | { type: "unresolved" };
        }
      | { type: "notRecorded" };
    workDuration: { type: "recorded"; value: number } | { type: "notRecorded" };
  };
};

function NotRecorded() {
  return <span className="text-muted-foreground">未記録</span>;
}

export function KarteTable({
  kartes,
  emptyMessage = "条件に一致するカルテデータが見つかりません",
}: {
  kartes: KarteTableRow[];
  emptyMessage?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap">記録日時</TableHead>
          <TableHead className="whitespace-nowrap">相談日時</TableHead>
          <TableHead>相談者</TableHead>
          <TableHead>対象端末</TableHead>
          <TableHead>カテゴリ</TableHead>
          <TableHead className="min-w-48">トラブル詳細</TableHead>
          <TableHead>担当者</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead className="whitespace-nowrap">作業時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kartes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          kartes.map((karte) => (
            <TableRow key={karte.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {new Date(karte.recordedAt).toLocaleString("ja-JP")}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {karte.consultedAt.type === "recorded" ? (
                  new Date(karte.consultedAt.value as string).toLocaleString("ja-JP")
                ) : (
                  <NotRecorded />
                )}
              </TableCell>
              <TableCell className="text-sm">
                {karte.client.type === "recorded" ? karte.client.value.name : <NotRecorded />}
              </TableCell>
              <TableCell className="text-sm">
                {karte.consultation.targetDevice.type === "recorded" ? (
                  karte.consultation.targetDevice.value
                ) : (
                  <NotRecorded />
                )}
              </TableCell>
              <TableCell className="text-sm">
                {karte.consultation.categories.type === "recorded" ? (
                  <div className="flex flex-wrap gap-1">
                    {karte.consultation.categories.value.map((cat) => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.id}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <NotRecorded />
                )}
              </TableCell>
              <TableCell className="text-sm max-w-xs truncate">
                {karte.consultation.troubleDetails}
              </TableCell>
              <TableCell className="text-sm">
                {karte.assignedMemberNames.length > 0 ? (
                  karte.assignedMemberNames.join(", ")
                ) : (
                  <NotRecorded />
                )}
              </TableCell>
              <TableCell>
                {karte.supportRecord.resolution.type === "recorded" ? (
                  karte.supportRecord.resolution.value.type === "resolved" ? (
                    <Badge variant="secondary">解決</Badge>
                  ) : (
                    <Badge variant="destructive">未解決</Badge>
                  )
                ) : (
                  <Badge variant="outline">未記録</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-right">
                {karte.supportRecord.workDuration.type === "recorded" ? (
                  `${karte.supportRecord.workDuration.value}分`
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
