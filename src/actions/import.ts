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
  type Client,
  type ConsultationCategory,
  type FollowUp,
  type MemberId,
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
    | {
        type: "staff";
        name: string;
      };
  consent: { liabilityConsent: boolean; disclosureConsent: boolean };
  categories: { id: string; displayName: string }[];
  targetDevice: string;
  troubleDetails: string;
  assignedMemberIds: string[];
  supportContent: string;
  resolution: "resolved" | "unresolved";
  followUp: string | null;
  workDurationMinutes: number | null;
};

export type ImportResult = {
  total: number;
  succeeded: number;
  failed: { index: number; error: string }[];
};

function toClient(params: ImportRow["client"]): Client {
  if (params.type === "staff") {
    return { type: "staff", name: params.name };
  }

  const gradeMatch = params.grade.match(/^(学部|修士)\s*(\d+)年$/);
  const year = gradeMatch ? Number(gradeMatch[2]) : 1;
  const course = gradeMatch?.[1] ?? "学部";

  const affiliation =
    course === "修士"
      ? new MasterAffiliation({
          school: "総合科学技術研究科" as never,
          major: params.department as never,
          year: year as never,
        })
      : new UndergraduateAffiliation({
          faculty: params.faculty as never,
          department: params.department as never,
          year: year as never,
        });

  return {
    type: "student",
    studentId: StudentId.fromString(params.studentId),
    name: params.name,
    affiliation,
  };
}

function toResolution(
  resolution: "resolved" | "unresolved",
  followUp: string | null,
): Recorded<Resolution> {
  if (resolution === "resolved") {
    return recorded({ type: "resolved" });
  }
  const followUpRecorded: Recorded<FollowUp> =
    followUp !== null ? recorded(followUp as FollowUp) : notRecorded();
  return recorded({ type: "unresolved", followUp: followUpRecorded });
}

export async function importKartes(rows: ImportRow[]): Promise<ImportResult> {
  const failed: { index: number; error: string }[] = [];
  let succeeded = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const categories = row.categories as unknown as ConsultationCategory[];
      const memberIds = row.assignedMemberIds.map((id) => memberId(id)) as unknown as MemberId[];

      await karteUseCases.importKarte.execute({
        id: karteId(randomUUID()),
        recordedAt: new Date(row.recordedAt),
        consultedAt: recorded(new Date(row.consultedAt)),
        lastUpdatedAt: new Date(row.recordedAt),
        client: recorded(toClient(row.client)),
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
          assignedMemberIds:
            memberIds.length > 0
              ? recorded(memberIds as unknown as NonEmptyArray<MemberId>)
              : notRecorded(),
          content: row.supportContent,
          resolution: toResolution(row.resolution, row.followUp),
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
