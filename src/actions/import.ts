"use server";

import {
  createKarteUseCases,
  karteId,
  recorded,
  notRecorded,
  workDuration,
  StudentId,
  type Affiliation,
  type PartialAffiliation,
  type Assignee,
  type Client,
  type ConsultedAt,
  type ConsultationCategory,
  type FollowUp,
  type Recorded,
  type Resolution,
  memberId,
} from "@shizuoka-its/core";
import { randomUUID } from "node:crypto";

const karteUseCases = createKarteUseCases();

function parseConsultedAtString(input: string): ConsultedAt {
  const trimmed = input.trim().replace(/\//g, "-");
  if (/^\d{4}$/.test(trimmed)) return { precision: "year", year: Number(trimmed) };
  if (/^\d{4}-\d{1,2}$/.test(trimmed)) {
    const [y, m] = trimmed.split("-").map(Number) as [number, number];
    return { precision: "yearMonth", year: y, month: m };
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed))
    return { precision: "date", value: new Date(`${trimmed}T00:00:00`) };
  return { precision: "datetime", value: new Date(trimmed.replace(" ", "T")) };
}

type ImportRow = {
  recordedAt: string;
  consultedAt: string | null;
  client:
    | {
        type: "student";
        studentId: string;
        name: string;
        faculty: string;
        department: string;
        grade: string;
      }
    | { type: "staff"; name: string }
    | { type: "teacher"; name: string }
    | { type: "other"; name: string }
    | null;
  consent: { liabilityConsent: boolean; disclosureConsent: boolean };
  categories: { id: string; displayName: string }[];
  targetDevice: string;
  troubleDetails: string;
  /** MemberIdとして解決済みのID */
  resolvedMemberIds: string[];
  /** 解決できなかった対応者名 */
  unresolvedAssigneeNames: string[];
  supportContent: string;
  resolution: "resolved" | "unresolved" | "";
  followUp: string | null;
  workDurationMinutes: number | null;
};

export type ImportResult = {
  total: number;
  succeeded: number;
  failed: { index: number; error: string }[];
};

function toRecordedClient(params: ImportRow["client"]): Recorded<Client> {
  if (params === null) return notRecorded();

  if (params.type === "staff") return recorded({ type: "staff", name: params.name });
  if (params.type === "teacher") return recorded({ type: "teacher", name: params.name });
  if (params.type === "other") return recorded({ type: "other", name: params.name });

  try {
    const gradeMatch = params.grade.match(/^(学部|修士)\s*(\d+)年$/);
    const year = gradeMatch ? Number(gradeMatch[2]) : undefined;
    const course = gradeMatch?.[1];

    if (!course) {
      // 課程不明 — 学部/学科情報があれば学部生として部分所属
      const affiliation = params.faculty
        ? ({
            type: "undergraduate",
            value: { faculty: params.faculty, department: params.department },
          } as unknown as PartialAffiliation)
        : undefined;
      return affiliation
        ? recorded({
            type: "student",
            studentId: StudentId.fromString(params.studentId),
            name: params.name,
            affiliation,
          })
        : recorded({
            type: "student",
            studentId: StudentId.fromString(params.studentId),
            name: params.name,
            affiliation: { type: "undergraduate", value: {} } as unknown as PartialAffiliation,
          });
    }

    const affiliation =
      course === "修士"
        ? year !== undefined
          ? ({
              type: "master",
              value: { school: "総合科学技術研究科", major: params.department, year },
            } as unknown as Affiliation)
          : ({
              type: "master",
              value: { school: "総合科学技術研究科", major: params.department },
            } as unknown as PartialAffiliation)
        : year !== undefined
          ? ({
              type: "undergraduate",
              value: { faculty: params.faculty, department: params.department, year },
            } as unknown as Affiliation)
          : ({
              type: "undergraduate",
              value: { faculty: params.faculty, department: params.department },
            } as unknown as PartialAffiliation);

    return recorded({
      type: "student",
      studentId: StudentId.fromString(params.studentId),
      name: params.name,
      affiliation,
    });
  } catch {
    return notRecorded();
  }
}

function toRecordedResolution(
  resolution: "resolved" | "unresolved" | "",
  followUp: string | null,
): Recorded<Resolution> {
  if (resolution === "") return notRecorded();
  if (resolution === "resolved") {
    return recorded({ type: "resolved" });
  }
  const followUpRecorded: Recorded<FollowUp> =
    followUp !== null ? recorded(followUp as FollowUp) : notRecorded();
  return recorded({ type: "unresolved", followUp: followUpRecorded });
}

function toAssignees(row: ImportRow): Recorded<[Assignee, ...Assignee[]]> {
  const assignees: Assignee[] = [
    ...row.resolvedMemberIds.map((id): Assignee => ({ type: "resolved", memberId: memberId(id) })),
    ...row.unresolvedAssigneeNames.map((name): Assignee => ({ type: "unresolved", name })),
  ];
  if (assignees.length === 0) return notRecorded();
  return recorded(assignees as [Assignee, ...Assignee[]]);
}

export async function importKartes(rows: ImportRow[]): Promise<ImportResult> {
  const failed: { index: number; error: string }[] = [];
  let succeeded = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const categories = row.categories as unknown as ConsultationCategory[];

      await karteUseCases.importKarte.execute({
        id: karteId(randomUUID()),
        recordedAt: new Date(row.recordedAt),
        consultedAt: row.consultedAt
          ? recorded(parseConsultedAtString(row.consultedAt))
          : notRecorded(),
        lastUpdatedAt: new Date(row.recordedAt),
        client: toRecordedClient(row.client),
        consent: row.consent,
        consultation: {
          categories:
            categories.length > 0
              ? recorded(categories as [ConsultationCategory, ...ConsultationCategory[]])
              : notRecorded(),
          targetDevice: recorded(row.targetDevice),
          troubleDetails: row.troubleDetails ? recorded(row.troubleDetails) : notRecorded(),
        },
        supportRecord: {
          assignees: toAssignees(row),
          content: row.supportContent ? recorded(row.supportContent) : notRecorded(),
          resolution: toRecordedResolution(row.resolution, row.followUp),
          workDuration:
            row.workDurationMinutes !== null
              ? recorded(workDuration(row.workDurationMinutes))
              : notRecorded(),
        },
      });
      succeeded++;
    } catch (e) {
      failed.push({
        index: i,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { total: rows.length, succeeded, failed };
}
