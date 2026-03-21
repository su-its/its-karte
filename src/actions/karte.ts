"use server";

import {
  createKarteUseCases,
  createMemberUseCases,
  karteId,
  type Karte,
  type Member,
  type Recorded,
} from "@shizuoka-its/core";

const karteUseCases = createKarteUseCases();
const memberUseCases = createMemberUseCases();

/** シリアライズ済みカルテ（Server Action → Client Componentに渡せる形式） */
export type SerializedKarte = ReturnType<typeof serializeKarte>;
export type SerializedMember = ReturnType<typeof serializeMember>;

export async function listKartes() {
  const { kartes } = await karteUseCases.listKartes.execute({});
  return kartes.map(serializeKarte);
}

export async function getKarte(id: string) {
  const { karte } = await karteUseCases.getKarte.execute({
    karteId: karteId(id),
  });
  return serializeKarte(karte);
}

export async function listMembers() {
  const { members } = await memberUseCases.getMemberList.execute({});
  return members.map(serializeMember);
}

function serializeRecorded<T>(
  r: Recorded<T>,
): { type: "recorded"; value: T } | { type: "notRecorded" } {
  return r.type === "recorded" ? { type: "recorded", value: r.value } : { type: "notRecorded" };
}

function serializeKarte(karte: Karte) {
  return {
    id: karte.id as string,
    recordedAt: karte.recordedAt.toISOString(),
    lastUpdatedAt: karte.lastUpdatedAt.toISOString(),
    consultedAt: serializeRecorded(karte.consultedAt),
    client: karte.client,
    consent: karte.consent,
    consultation: karte.consultation,
    supportRecord: karte.supportRecord,
  };
}

function serializeMember(member: Member) {
  return {
    id: member.id as string,
    name: member.getName(),
    studentId: member.getStudentId().getValue(),
  };
}
