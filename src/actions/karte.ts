"use server";

import {
  createKarteUseCases,
  createMemberUseCases,
  karteId,
  memberId,
  workDuration,
  StudentId,
  CONSULTATION_CATEGORIES,
  type Karte,
  type Client,
  type Member,
  type Recorded,
  type Resolution,
  type MemberId,
  type Affiliation,
  type ConsultationCategory,
  type FollowUp,
  type NonEmptyArray,
  UndergraduateAffiliation,
  MasterAffiliation,
  DoctoralAffiliation,
  ProfessionalAffiliation,
} from "@shizuoka-its/core";
import { randomUUID } from "node:crypto";

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
    id: karteId(id),
  });
  if (!karte) return null;
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
  if (affiliation instanceof UndergraduateAffiliation) {
    const v = affiliation.getValue();
    return `${String(v.faculty)} ${String("department" in v ? v.department : "")} ${String(v.year)}年`.trim();
  }
  if (affiliation instanceof MasterAffiliation) {
    const v = affiliation.getValue();
    const major = "major" in v ? String(v.major) : "";
    return `${String(v.school)} ${major} M${String(v.year)}`.trim();
  }
  if (affiliation instanceof DoctoralAffiliation) {
    const v = affiliation.getValue();
    return `${String(v.school)} ${String(v.major)} D${String(v.year)}`.trim();
  }
  if (affiliation instanceof ProfessionalAffiliation) {
    const v = affiliation.getValue();
    return `${String(v.school)} ${String(v.major)} ${String(v.year)}年`.trim();
  }
  return "";
}

type SerializedAffiliationData = {
  courseType: "undergraduate" | "master" | "doctoral" | "professional";
  faculty: string;
  department: string;
  year: number;
};

function serializeAffiliationData(affiliation: Affiliation): SerializedAffiliationData {
  const value = affiliation.getValue() as Record<string, unknown>;
  if (affiliation instanceof UndergraduateAffiliation) {
    return {
      courseType: "undergraduate",
      faculty: (value.faculty ?? "") as string,
      department: (value.department ?? value.program ?? "") as string,
      year: (value.year ?? 1) as number,
    };
  }
  if (affiliation instanceof MasterAffiliation) {
    return {
      courseType: "master",
      faculty: (value.school ?? "") as string,
      department: (value.major ?? "") as string,
      year: (value.year ?? 1) as number,
    };
  }
  if (affiliation instanceof DoctoralAffiliation) {
    return {
      courseType: "doctoral",
      faculty: (value.school ?? "") as string,
      department: (value.major ?? "") as string,
      year: (value.year ?? 1) as number,
    };
  }
  return {
    courseType: "professional",
    faculty: (value.school ?? "") as string,
    department: (value.major ?? "") as string,
    year: (value.year ?? 1) as number,
  };
}

function serializeClient(client: Recorded<Client>):
  | {
      type: "recorded";
      value: {
        type: string;
        name: string;
        studentId?: string;
        affiliation?: string;
        affiliationData?: SerializedAffiliationData;
      };
    }
  | { type: "notRecorded" } {
  if (client.type === "notRecorded") return { type: "notRecorded" };
  const c = client.value;
  const label = CLIENT_TYPE_LABELS[c.type] ?? c.type;
  if (c.type === "student") {
    const affDisplay = formatAffiliation(c.affiliation);
    return {
      type: "recorded",
      value: {
        type: label,
        name: c.name,
        studentId: c.studentId.getValue(),
        affiliation: `${label} / ${affDisplay}`,
        affiliationData: serializeAffiliationData(c.affiliation),
      },
    };
  }
  return {
    type: "recorded",
    value: { type: label, name: c.name, affiliation: label },
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

// ============================================================================
// Create / Correct Actions
// ============================================================================

export type KarteFormInput = {
  consultedAt: string;
  clientType: "student" | "teacher" | "staff" | "other";
  clientName: string;
  studentId: string;
  courseType: "undergraduate" | "master" | "doctoral" | "professional";
  faculty: string;
  department: string;
  year: number;
  liabilityConsent: boolean;
  disclosureConsent: boolean;
  categoryIds: string[];
  targetDevice: string;
  troubleDetails: string;
  assignedMemberIds: string[];
  supportContent: string;
  resolutionType: "resolved" | "unresolved";
  followUp: string;
  workDurationMinutes: number;
};

function buildClient(input: KarteFormInput): Client {
  const name = input.clientName;
  switch (input.clientType) {
    case "student": {
      const sid = StudentId.fromString(input.studentId);
      const affiliation = buildAffiliation(input);
      return { type: "student", studentId: sid, name, affiliation };
    }
    case "teacher":
      return { type: "teacher", name };
    case "staff":
      return { type: "staff", name };
    case "other":
      return { type: "other", name };
  }
}

function buildAffiliation(input: KarteFormInput): Affiliation {
  switch (input.courseType) {
    case "undergraduate":
      return new UndergraduateAffiliation({
        faculty: input.faculty as never,
        department: input.department as never,
        year: input.year as never,
      });
    case "master":
      return new MasterAffiliation({
        school: input.faculty as never,
        major: input.department as never,
        year: input.year as never,
      });
    case "doctoral":
      return new DoctoralAffiliation({
        school: input.faculty as never,
        major: input.department as never,
        year: input.year as never,
      });
    case "professional":
      return new ProfessionalAffiliation({
        school: input.faculty as never,
        major: input.department as never,
        year: input.year as never,
      });
  }
}

function buildCategories(ids: string[]): NonEmptyArray<ConsultationCategory> {
  const cats = ids
    .map((id) => CONSULTATION_CATEGORIES.find((c) => c.id === id))
    .filter((c): c is ConsultationCategory => c !== undefined);
  if (cats.length === 0) throw new Error("カテゴリを1つ以上選択してください");
  return cats as unknown as NonEmptyArray<ConsultationCategory>;
}

export async function createKarte(input: KarteFormInput) {
  const id = karteId(randomUUID());
  const client = buildClient(input);
  const categories = buildCategories(input.categoryIds);
  const memberIds = input.assignedMemberIds.map((mid) => memberId(mid));
  if (memberIds.length === 0) throw new Error("担当者を1人以上選択してください");

  const resolution =
    input.resolutionType === "resolved"
      ? { type: "resolved" as const }
      : { type: "unresolved" as const, followUp: input.followUp as FollowUp };

  await karteUseCases.createKarte.execute({
    id,
    consultedAt: new Date(input.consultedAt),
    client,
    consent: {
      liabilityConsent: input.liabilityConsent,
      disclosureConsent: input.disclosureConsent,
    },
    consultation: {
      categories,
      targetDevice: input.targetDevice,
      troubleDetails: input.troubleDetails,
    },
    supportRecord: {
      assignedMemberIds: memberIds as unknown as NonEmptyArray<MemberId>,
      content: input.supportContent,
      resolution,
      workDuration: workDuration(input.workDurationMinutes),
    },
  });

  return { id: id as string };
}
