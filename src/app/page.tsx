import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 p-8">
      <h1 className="text-2xl font-bold mb-6">ITS Karte</h1>
      <nav className="flex flex-col gap-2">
        <Link href="/kartes" className="text-blue-600 hover:underline">
          カルテ一覧
        </Link>
        <Link href="/kartes/import" className="text-blue-600 hover:underline">
          CSVインポート
        </Link>
      </nav>
    </main>
  );
}
