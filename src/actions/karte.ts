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
  type PartialAffiliation,
  type Assignee,
  type ConsultedAt,
  type ConsultationCategory,
  type FollowUp,
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
    memberMap.set(m.id as string, m.name);
  }

  return kartes.map((karte) => ({
    ...serializeKarte(karte),
    assignedMemberNames: resolveAssigneeNames(karte.supportRecord.assignees, memberMap),
  }));
}

export async function getKarte(id: string) {
  const { karte } = await karteUseCases.getKarte.execute({
    karteId: karteId(id),
  });
  if (!karte) return null;
  return serializeKarte(karte);
}

export async function listCategories() {
  return CONSULTATION_CATEGORIES.map((c) => ({ id: c.id, displayName: c.displayName }));
}

export async function listMembers() {
  const { members } = await memberUseCases.getMemberList.execute({});
  return members.map(serializeMember);
}

function resolveAssigneeNames(
  assignees: Recorded<readonly Assignee[]>,
  memberMap: Map<string, string>,
): string[] {
  if (assignees.type === "notRecorded") return [];
  return assignees.value.map((a) => {
    if (a.type === "unresolved") return a.name;
    return memberMap.get(a.memberId as string) ?? (a.memberId as string);
  });
}

function serializeRecorded<T, U>(
  r: Recorded<T>,
  transform: (v: T) => U,
): { type: "recorded"; value: U } | { type: "notRecorded" } {
  return r.type === "recorded"
    ? { type: "recorded", value: transform(r.value) }
    : { type: "notRecorded" };
}

function serializeConsultedAt(ca: ConsultedAt): {
  precision: "datetime" | "date" | "yearMonth" | "year";
  value: string;
} {
  switch (ca.precision) {
    case "year":
      return { precision: "year", value: String(ca.year) };
    case "yearMonth":
      return { precision: "yearMonth", value: `${ca.year}-${String(ca.month).padStart(2, "0")}` };
    case "date":
      return { precision: "date", value: ca.value.toISOString().slice(0, 10) };
    case "datetime":
      return { precision: "datetime", value: ca.value.toISOString() };
  }
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  student: "学生",
  teacher: "教員",
  staff: "職員",
  other: "その他",
};

function formatAffiliation(affiliation: Affiliation | PartialAffiliation): string {
  const v = affiliation.value as Record<string, string | number | undefined>;
  const faculty = String(v.faculty ?? v.school ?? "");
  const dept = String(v.department ?? v.major ?? v.program ?? "");
  const yearNum = v.year !== undefined ? Number(v.year) : null;

  const yearSuffix =
    affiliation.type === "master" ? "M" : affiliation.type === "doctoral" ? "D" : "";

  if (yearNum !== null) {
    return [faculty, dept, `${yearSuffix}${String(yearNum)}年`].filter(Boolean).join(" ");
  }
  return [faculty, dept].filter(Boolean).join(" ");
}

type SerializedAffiliationData = {
  courseType: "undergraduate" | "master" | "doctoral" | "professional";
  faculty: string;
  department: string;
  year: number | null;
};

function serializeAffiliationData(
  affiliation: Affiliation | PartialAffiliation,
): SerializedAffiliationData {
  const value = affiliation.value as Record<string, unknown>;
  const year = ("year" in value ? value.year : null) as number | null;

  switch (affiliation.type) {
    case "undergraduate":
      return {
        courseType: "undergraduate",
        faculty: (value.faculty ?? "") as string,
        department: (value.department ?? "") as string,
        year,
      };
    case "master":
      return {
        courseType: "master",
        faculty: (value.school ?? "") as string,
        department: (value.major ?? "") as string,
        year,
      };
    case "doctoral":
      return {
        courseType: "doctoral",
        faculty: (value.school ?? "") as string,
        department: (value.major ?? "") as string,
        year,
      };
    case "professional":
      return {
        courseType: "professional",
        faculty: (value.school ?? "") as string,
        department: (value.major ?? "") as string,
        year,
      };
  }
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
    consultedAt: serializeRecorded(karte.consultedAt, serializeConsultedAt),
    client: serializeClient(karte.client),
    consent: karte.consent,
    consultation: {
      targetDevice: serializeRecorded(karte.consultation.targetDevice, (v: string) => v),
      categories: serializeRecorded(karte.consultation.categories, (cats) =>
        cats.map((c) => ({ id: c.id, displayName: c.displayName })),
      ),
      troubleDetails: serializeRecorded(karte.consultation.troubleDetails, (v: string) => v),
    },
    supportRecord: {
      content: serializeRecorded(karte.supportRecord.content, (v: string) => v),
      resolution: serializeResolution(karte.supportRecord.resolution),
      workDuration: serializeRecorded(karte.supportRecord.workDuration, (v) => v as number),
    },
  };
}

function serializeMember(member: Member) {
  if (member.status === "active") {
    const affValue = member.affiliation?.value as Record<string, unknown> | undefined;
    return {
      id: member.id as string,
      name: member.name,
      studentId: member.studentId.getValue(),
      department: (affValue?.department ?? affValue?.major ?? "") as string,
      email: member.email.getValue(),
    };
  }
  return {
    id: member.id as string,
    name: member.name,
    studentId: undefined,
    department: "",
    email: member.email.getValue(),
  };
}

// ============================================================================
// Create / Correct Actions
// ============================================================================

export type KarteFormInput = {
  consultedAtPrecision: "datetime" | "date" | "yearMonth" | "year";
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

function buildConsultedAt(input: KarteFormInput): ConsultedAt {
  switch (input.consultedAtPrecision) {
    case "year":
      return { precision: "year", year: Number(input.consultedAt) };
    case "yearMonth": {
      const [y, m] = input.consultedAt.split("-").map(Number) as [number, number];
      return { precision: "yearMonth", year: y, month: m };
    }
    case "date":
      return { precision: "date", value: new Date(`${input.consultedAt}T00:00:00`) };
    case "datetime":
      return { precision: "datetime", value: new Date(input.consultedAt) };
  }
}

function buildAffiliation(input: KarteFormInput): Affiliation {
  const value =
    input.courseType === "undergraduate"
      ? { faculty: input.faculty, department: input.department, year: input.year }
      : { school: input.faculty, major: input.department, year: input.year };
  return { type: input.courseType, value } as unknown as Affiliation;
}

function buildCategories(ids: string[]): [ConsultationCategory, ...ConsultationCategory[]] {
  const cats = ids
    .map((id) => CONSULTATION_CATEGORIES.find((c) => c.id === id))
    .filter((c): c is ConsultationCategory => c !== undefined);
  if (cats.length === 0) throw new Error("カテゴリを1つ以上選択してください");
  return cats as [ConsultationCategory, ...ConsultationCategory[]];
}

export async function createKarte(input: KarteFormInput) {
  const id = karteId(randomUUID());
  const categories = buildCategories(input.categoryIds);
  const memberIds = input.assignedMemberIds.map((mid) => memberId(mid));
  if (memberIds.length === 0) throw new Error("担当者を1人以上選択してください");

  const resolution =
    input.resolutionType === "resolved"
      ? { type: "resolved" as const }
      : { type: "unresolved" as const, followUp: input.followUp as FollowUp };

  const name = input.clientName;
  const client =
    input.clientType === "student"
      ? {
          type: "student" as const,
          studentId: StudentId.fromString(input.studentId),
          name,
          affiliation: buildAffiliation(input),
        }
      : input.clientType === "teacher"
        ? { type: "teacher" as const, name }
        : input.clientType === "staff"
          ? { type: "staff" as const, name }
          : { type: "other" as const, name };

  await karteUseCases.createKarte.execute({
    id,
    consultedAt: buildConsultedAt(input),
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
      assignedMemberIds: memberIds as unknown as [MemberId, ...MemberId[]],
      content: input.supportContent,
      resolution,
      workDuration: workDuration(input.workDurationMinutes),
    },
  });

  return { id: id as string };
}
