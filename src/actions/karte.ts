"use server";

import {
  createKarteUseCases,
  createMemberUseCases,
  karteId,
  type Karte,
  type Member,
  type Recorded,
  type MemberId,
} from "@shizuoka-its/core";

const karteUseCases = createKarteUseCases();
const memberUseCases = createMemberUseCases();

export type SerializedKarte = ReturnType<typeof serializeKarte>;
export type SerializedMember = ReturnType<typeof serializeMember>;

export async function listKartesWithMembers() {
  const [{ kartes }, { members }] = await Promise.all([
    karteUseCases.listKartes.execute({}),
    memberUseCases.getMemberList.execute({}),
  ]);

  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.id as string, m.getName());
  }

  return kartes.map((karte) => ({
    ...serializeKarte(karte),
    assignedMemberNames: resolveAssignedMemberNames(
      karte.supportRecord.assignedMemberIds,
      memberMap,
    ),
  }));
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

function resolveAssignedMemberNames(
  assignedMemberIds: Recorded<readonly MemberId[]>,
  memberMap: Map<string, string>,
): string[] {
  if (assignedMemberIds.type === "notRecorded") return [];
  return assignedMemberIds.value.map((id) => memberMap.get(id as string) ?? (id as string));
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
