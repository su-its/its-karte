import { listKartesWithMembers, listMembers } from "@/actions/karte";
import { CONSULTATION_CATEGORIES } from "@shizuoka-its/core";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KarteListWithDetail } from "@/components/karte-list-with-detail";
import { FileSpreadsheetIcon, PlusIcon } from "lucide-react";

export default async function KartesPage() {
  const [kartes, members] = await Promise.all([listKartesWithMembers(), listMembers()]);

  return (
    <main className="flex-1 px-8 py-8 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">カルテ一覧</h1>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href="/new" />}>
            <PlusIcon data-icon="inline-start" />
            カルテ作成
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/import" />}>
            <FileSpreadsheetIcon data-icon="inline-start" />
            CSVインポート
          </Button>
        </div>
      </div>

      <KarteListWithDetail
        kartes={kartes}
        members={members.map((m) => ({ id: m.id, name: m.name, studentId: m.studentId }))}
        categories={CONSULTATION_CATEGORIES.map((c) => ({ id: c.id, displayName: c.displayName }))}
      />
    </main>
  );
}
