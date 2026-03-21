import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckIcon, XIcon } from "lucide-react";

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
};

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
}: {
  kartes: KarteTableRow[];
  emptyMessage?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap">ID</TableHead>
          <TableHead className="whitespace-nowrap">記録日時</TableHead>
          <TableHead className="whitespace-nowrap">相談日時</TableHead>
          <TableHead>相談者</TableHead>
          <TableHead className="whitespace-nowrap">免責</TableHead>
          <TableHead className="whitespace-nowrap">公開</TableHead>
          <TableHead>対象端末</TableHead>
          <TableHead>カテゴリ</TableHead>
          <TableHead className="min-w-48">トラブル詳細</TableHead>
          <TableHead className="min-w-48">対応内容</TableHead>
          <TableHead>担当者</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead className="whitespace-nowrap">作業時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kartes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={13} className="h-32 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          kartes.map((karte) => (
            <TableRow key={karte.id}>
              <TableCell className="text-xs text-muted-foreground font-mono">
                {karte.id.slice(0, 8)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {new Date(karte.recordedAt).toLocaleString("ja-JP")}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {karte.consultedAt.type === "recorded" ? (
                  new Date(karte.consultedAt.value).toLocaleString("ja-JP")
                ) : (
                  <NotRecorded />
                )}
              </TableCell>
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
              <TableCell className="text-center">
                <ConsentIcon consented={karte.consent.liabilityConsent} />
              </TableCell>
              <TableCell className="text-center">
                <ConsentIcon consented={karte.consent.disclosureConsent} />
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
                        {cat.displayName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <NotRecorded />
                )}
              </TableCell>
              <TableCell className="text-sm max-w-xs">
                <div className="line-clamp-3">{karte.consultation.troubleDetails}</div>
              </TableCell>
              <TableCell className="text-sm max-w-xs">
                <div className="line-clamp-3">{karte.supportRecord.content}</div>
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
