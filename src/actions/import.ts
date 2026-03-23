"use server";

import {
  createKarteUseCases,
  karteId,
  recorded,
  notRecorded,
  workDuration,
  StudentId,
  UndergraduateAffiliation,
  MasterAffiliation,
  PartialUndergraduateAffiliation,
  PartialMasterAffiliation,
  type Assignee,
  type Client,
  type ConsultationCategory,
  type FollowUp,
  type NonEmptyArray,
  type Recorded,
  type Resolution,
  memberId,
} from "@shizuoka-its/core";
import { randomUUID } from "node:crypto";

const karteUseCases = createKarteUseCases();

type ImportRow = {
  recordedAt: string;
  consultedAt: string;
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
    const course = gradeMatch?.[1] ?? "学部";

    const affiliation =
      course === "修士"
        ? year !== undefined
          ? new MasterAffiliation({
              school: "総合科学技術研究科" as never,
              major: params.department as never,
              year: year as never,
            })
          : new PartialMasterAffiliation({
              school: "総合科学技術研究科" as never,
              major: params.department as never,
            } as never)
        : year !== undefined
          ? new UndergraduateAffiliation({
              faculty: params.faculty as never,
              department: params.department as never,
              year: year as never,
            })
          : new PartialUndergraduateAffiliation({
              faculty: params.faculty as never,
              department: params.department as never,
            } as never);

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

function toAssignees(row: ImportRow): Recorded<NonEmptyArray<Assignee>> {
  const assignees: Assignee[] = [
    ...row.resolvedMemberIds.map((id): Assignee => ({ type: "resolved", memberId: memberId(id) })),
    ...row.unresolvedAssigneeNames.map((name): Assignee => ({ type: "unresolved", name })),
  ];
  if (assignees.length === 0) return notRecorded();
  return recorded(assignees as unknown as NonEmptyArray<Assignee>);
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
        consultedAt: recorded(new Date(row.consultedAt)),
        lastUpdatedAt: new Date(row.recordedAt),
        client: toRecordedClient(row.client),
        consent: row.consent,
        consultation: {
          categories:
            categories.length > 0
              ? recorded(categories as unknown as NonEmptyArray<ConsultationCategory>)
              : notRecorded(),
          targetDevice: recorded(row.targetDevice),
          troubleDetails: row.troubleDetails,
        },
        supportRecord: {
          assignees: toAssignees(row),
          content: row.supportContent,
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
