import { listKartesWithMembers } from "@/actions/karte";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheetIcon, PlusIcon } from "lucide-react";

export default async function KartesPage() {
  const kartes = await listKartesWithMembers();

  return (
    <main className="flex-1 px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">カルテ一覧</h1>
        <div className="flex gap-2">
          <Button render={<Link href="/new" />}>
            <PlusIcon data-icon="inline-start" />
            カルテ作成
          </Button>
          <Button variant="outline" render={<Link href="/import" />}>
            <FileSpreadsheetIcon data-icon="inline-start" />
            CSVインポート
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
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
                    条件に一致するカルテデータが見つかりません
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
                        new Date(karte.consultedAt.value as unknown as string).toLocaleString(
                          "ja-JP",
                        )
                      ) : (
                        <span className="text-muted-foreground">未記録</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {karte.client.type === "recorded" ? (
                        karte.client.value.name
                      ) : (
                        <span className="text-muted-foreground">未記録</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {karte.consultation.targetDevice.type === "recorded" ? (
                        karte.consultation.targetDevice.value
                      ) : (
                        <span className="text-muted-foreground">未記録</span>
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
                        <span className="text-muted-foreground">未記録</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {karte.consultation.troubleDetails}
                    </TableCell>
                    <TableCell className="text-sm">
                      {karte.assignedMemberNames.length > 0 ? (
                        karte.assignedMemberNames.join(", ")
                      ) : (
                        <span className="text-muted-foreground">未記録</span>
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
        </CardContent>
      </Card>
    </main>
  );
}
