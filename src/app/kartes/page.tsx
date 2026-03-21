import { listKartes } from "@/actions/karte";
import Link from "next/link";

export default async function KartesPage() {
  const kartes = await listKartes();

  return (
    <main className="flex-1 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">カルテ一覧</h1>
        <Link
          href="/kartes/import"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          CSVインポート
        </Link>
      </div>

      {kartes.length === 0 ? (
        <p className="text-zinc-500">カルテが登録されていません。</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-zinc-500">
              <th className="py-2 pr-4">記録日時</th>
              <th className="py-2 pr-4">相談者</th>
              <th className="py-2 pr-4">トラブル詳細</th>
              <th className="py-2 pr-4">解決</th>
            </tr>
          </thead>
          <tbody>
            {kartes.map((karte) => (
              <tr key={karte.id} className="border-b hover:bg-zinc-50">
                <td className="py-2 pr-4 text-sm">
                  {new Date(karte.recordedAt).toLocaleString("ja-JP")}
                </td>
                <td className="py-2 pr-4 text-sm">
                  {karte.client.type === "recorded" ? karte.client.value.name : "未記録"}
                </td>
                <td className="py-2 pr-4 text-sm max-w-md truncate">
                  {karte.consultation.troubleDetails}
                </td>
                <td className="py-2 pr-4 text-sm">
                  {karte.supportRecord.resolution.type === "recorded"
                    ? karte.supportRecord.resolution.value.type === "resolved"
                      ? "解決"
                      : "未解決"
                    : "未記録"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
