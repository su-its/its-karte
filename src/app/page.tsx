import { listKartes } from "@/actions/karte";
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
  const kartes = await listKartes();

  return (
    <main className="flex-1 p-8 max-w-5xl mx-auto">
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
                <TableHead>記録日時</TableHead>
                <TableHead>相談者</TableHead>
                <TableHead>トラブル詳細</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kartes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    条件に一致するカルテデータが見つかりません
                  </TableCell>
                </TableRow>
              ) : (
                kartes.map((karte) => (
                  <TableRow key={karte.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(karte.recordedAt).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      {karte.client.type === "recorded" ? (
                        karte.client.value.name
                      ) : (
                        <Badge variant="secondary">未記録</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {karte.consultation.troubleDetails}
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
