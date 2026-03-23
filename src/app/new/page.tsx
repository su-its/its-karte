import { listMembers, createKarte } from "@/actions/karte";
import { CONSULTATION_CATEGORIES } from "@shizuoka-its/core";
import { NewKarteClient } from "./client";

export default async function NewKartePage() {
  const members = await listMembers();

  return (
    <main className="flex-1 px-8 py-8 max-w-screen-xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">カルテ作成</h1>
      <NewKarteClient
        members={members}
        categories={CONSULTATION_CATEGORIES.map((c) => ({ id: c.id, displayName: c.displayName }))}
        createKarte={createKarte}
      />
    </main>
  );
}
