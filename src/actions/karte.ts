"use server";

import {
  createKarteUseCases,
  createMemberUseCases,
  karteId,
  type Karte,
  type Client,
  type Member,
  type Recorded,
  type Resolution,
  type MemberId,
  type Affiliation,
  UndergraduateAffiliation,
  MasterAffiliation,
  DoctoralAffiliation,
  ProfessionalAffiliation,
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

function serializeRecorded<T, U>(
  r: Recorded<T>,
  transform: (v: T) => U,
): { type: "recorded"; value: U } | { type: "notRecorded" } {
  return r.type === "recorded"
    ? { type: "recorded", value: transform(r.value) }
    : { type: "notRecorded" };
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  student: "学生",
  teacher: "教員",
  staff: "職員",
  other: "その他",
};

function formatAffiliation(affiliation: Affiliation): string {
  const value = affiliation.getValue() as Record<string, unknown>;
  if (affiliation instanceof UndergraduateAffiliation) {
    return `${value.faculty} ${value.department ?? ""} ${value.year}年`.trim();
  }
  if (affiliation instanceof MasterAffiliation) {
    return `${value.school} ${value.major ?? ""} M${value.year}`.trim();
  }
  if (affiliation instanceof DoctoralAffiliation) {
    return `${value.school} ${value.major ?? ""} D${value.year}`.trim();
  }
  if (affiliation instanceof ProfessionalAffiliation) {
    return `${value.school} ${value.major ?? ""} ${value.year}年`.trim();
  }
  return "";
}

function serializeClient(client: Recorded<Client>):
  | {
      type: "recorded";
      value: { type: string; name: string; studentId?: string; affiliation?: string };
    }
  | { type: "notRecorded" } {
  if (client.type === "notRecorded") return { type: "notRecorded" };
  const c = client.value;
  const label = CLIENT_TYPE_LABELS[c.type] ?? c.type;
  const studentId = c.type === "student" ? c.studentId.getValue() : undefined;
  const affiliation = c.type === "student" ? formatAffiliation(c.affiliation) : undefined;
  return {
    type: "recorded",
    value: {
      type: label,
      name: c.name,
      studentId,
      affiliation: affiliation ? `${label} / ${affiliation}` : label,
    },
  };
}

function serializeResolution(
  resolution: Recorded<Resolution>,
):
  | { type: "recorded"; value: { type: "resolved" } | { type: "unresolved"; followUp?: string } }
  | { type: "notRecorded" } {
  if (resolution.type === "notRecorded") return { type: "notRecorded" };
  const r = resolution.value;
  if (r.type === "resolved") {
    return { type: "recorded", value: { type: "resolved" } };
  }
  return {
    type: "recorded",
    value: {
      type: "unresolved",
      followUp: r.followUp.type === "recorded" ? r.followUp.value : undefined,
    },
  };
}

function serializeKarte(karte: Karte) {
  return {
    id: karte.id as string,
    recordedAt: karte.recordedAt.toISOString(),
    lastUpdatedAt: karte.lastUpdatedAt.toISOString(),
    consultedAt: serializeRecorded(karte.consultedAt, (d: Date) => d.toISOString()),
    client: serializeClient(karte.client),
    consent: karte.consent,
    consultation: {
      targetDevice: serializeRecorded(karte.consultation.targetDevice, (v: string) => v),
      categories: serializeRecorded(karte.consultation.categories, (cats) =>
        cats.map((c) => ({ id: c.id, displayName: c.displayName })),
      ),
      troubleDetails: karte.consultation.troubleDetails,
    },
    supportRecord: {
      content: karte.supportRecord.content,
      resolution: serializeResolution(karte.supportRecord.resolution),
      workDuration: serializeRecorded(karte.supportRecord.workDuration, (v) => v as number),
    },
  };
}

function serializeMember(member: Member) {
  return {
    id: member.id as string,
    name: member.getName(),
    studentId: member.getStudentId().getValue(),
  };
}
