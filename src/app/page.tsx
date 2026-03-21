import { listKartesWithMembers } from "@/actions/karte";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KarteTable } from "@/components/karte-table";
import { FileSpreadsheetIcon, PlusIcon } from "lucide-react";

export default async function KartesPage() {
  const kartes = await listKartesWithMembers();

  return (
    <main className="flex-1 px-8 py-8 max-w-screen-2xl mx-auto w-full">
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
          <KarteTable kartes={kartes} />
        </CardContent>
      </Card>
    </main>
  );
}
