"use server";

import {
  createKarteUseCases,
  karteId,
  memberId,
  workDuration,
  nonEmptyString,
  StudentId,
  CONSULTATION_CATEGORIES,
  type CompleteAffiliation,
  type MemberId,
  type ConsultedAt,
  type ConsultationCategory,
  type FollowUp,
} from "@shizuoka-its/core";
import { randomUUID } from "node:crypto";

const karteUseCases = createKarteUseCases();

export type KarteFormInput = {
  consultedAtPrecision: "datetime" | "date" | "yearMonth" | "year";
  consultedAt: string;
  clientType: "student" | "teacher" | "staff" | "other";
  clientName: string;
  studentId: string;
  courseType: "undergraduate" | "master" | "doctoral" | "professional";
  faculty: string;
  enrollmentType: string;
  program: string;
  department: string;
  major: string;
  course: string;
  subspecialty: string;
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

function buildAffiliation(input: KarteFormInput): CompleteAffiliation {
  const omitEmpty = (obj: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined));

  const value =
    input.courseType === "undergraduate"
      ? omitEmpty({
          faculty: input.faculty,
          enrollmentType: input.enrollmentType,
          program: input.program,
          department: input.department,
          course: input.course,
          major: input.major,
          subspecialty: input.subspecialty,
          year: input.year,
        })
      : omitEmpty({
          school: input.faculty,
          major: input.major || input.department,
          course: input.course,
          year: input.year,
        });

  return { type: input.courseType, value } as unknown as CompleteAffiliation;
}

function buildCategories(ids: string[]): [ConsultationCategory, ...ConsultationCategory[]] {
  const cats = ids
    .map((id) => CONSULTATION_CATEGORIES.find((c) => c.id === id))
    .filter((c) => c !== undefined);
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
      targetDevice: nonEmptyString(input.targetDevice, "targetDevice"),
      troubleDetails: nonEmptyString(input.troubleDetails, "troubleDetails"),
    },
    supportRecord: {
      assignedMemberIds: memberIds as unknown as [MemberId, ...MemberId[]],
      content: nonEmptyString(input.supportContent, "supportContent"),
      resolution,
      workDuration: workDuration(input.workDurationMinutes),
    },
  });

  return { id: id as string };
}
