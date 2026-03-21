"use client";

import { useState } from "react";
import { parseCsv, type CsvRow } from "@/lib/parseCsv";
import { listMembers } from "@/actions/karte";
import { importKartes, type ImportResult } from "@/actions/import";
import type { ConsultationCategoryId } from "@shizuoka-its/core";

type MemberInfo = { id: string; name: string; studentId: string };
type Step = "upload" | "preview" | "memberMapping" | "importing" | "done";

const TAG_MAPPING: Record<string, ConsultationCategoryId> = {
  wifi_eduroam: "wifi_eduroam",
  wifi_succes: "wifi_success",
  wifi_success: "wifi_success",
  wifi_smartphone: "wifi_smartphone",
  usage_mac: "usage_mac",
  usage_fs: "usage_fs",
  usage_vpn: "usage_vpn",
  usage_mail: "usage_mail",
  usage_gakujo: "usage_gakujo",
  usage_onedrive: "usage_onedrive",
  usage_printer: "usage_printer",
  usage_vm: "usage_vm",
  usage_ms_software: "usage_ms_software",
  hardware_pc: "hardware_pc",
  problem_credential: "problem_credential",
  problem_os: "problem_windows",
  problem_windows: "problem_windows",
  problem_linux: "problem_linux",
  programming: "programming",
  rent: "rent",
  other: "other",
};

function parseGradeType(grade: string): "student" | "staff" {
  return grade === "職員" ? "staff" : "student";
}

function parseCategoryTags(tags: string) {
  return tags
    .split(", ")
    .map((tag) => {
      const id = tag.split(" ")[0];
      const mappedId = TAG_MAPPING[id];
      if (!mappedId) return null;
      return { id: mappedId, displayName: tag };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [memberMapping, setMemberMapping] = useState<Map<string, string>>(new Map());
  const [unmatchedAssignees, setUnmatchedAssignees] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSVの読み込みに失敗しました");
    }
  }

  async function handlePreviewConfirm() {
    const memberList = await listMembers();
    setMembers(memberList);

    const assigneeIds = new Set<string>();
    for (const row of rows) {
      for (const id of row.assignee
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        assigneeIds.add(id);
      }
    }

    const mapping = new Map<string, string>();
    const unmatched: string[] = [];
    for (const assigneeId of assigneeIds) {
      const member = memberList.find((m) => m.studentId === assigneeId);
      if (member) {
        mapping.set(assigneeId, member.id);
      } else {
        unmatched.push(assigneeId);
      }
    }

    setMemberMapping(mapping);
    setUnmatchedAssignees(unmatched);
    setStep(unmatched.length > 0 ? "memberMapping" : "importing");

    if (unmatched.length === 0) {
      await executeImport(mapping);
    }
  }

  function handleMemberSelect(assigneeId: string, memberId: string) {
    setMemberMapping((prev) => new Map(prev).set(assigneeId, memberId));
  }

  async function handleMappingConfirm() {
    setStep("importing");
    await executeImport(memberMapping);
  }

  async function executeImport(mapping: Map<string, string>) {
    const importRows = rows.map((row) => {
      const gradeType = parseGradeType(row.grade);
      const assigneeIds = row.assignee
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => mapping.get(id))
        .filter((id): id is string => id !== undefined);

      return {
        recordedAt: new Date(row.timestamp.replace(/\//g, "-")).toISOString(),
        consultedAt: new Date(row.date.replace(/\//g, "-")).toISOString(),
        client:
          gradeType === "staff"
            ? { type: "staff" as const, name: row.name }
            : {
                type: "student" as const,
                studentId: row.studentId,
                name: row.name,
                faculty: row.faculty,
                department: row.department,
                grade: row.grade,
              },
        consent: {
          liabilityConsent: row.liabilityConsent === "同意する",
          disclosureConsent: row.disclosureConsent === "同意する",
        },
        categories: parseCategoryTags(row.categoryTags),
        targetDevice: row.targetDevice,
        troubleDetails: row.troubleDetails,
        assignedMemberIds: assigneeIds,
        supportContent: row.supportContent,
        resolution: (row.resolution === "解決" ? "resolved" : "unresolved") as
          | "resolved"
          | "unresolved",
        followUp: row.followUp || null,
        workDurationMinutes: row.workDuration ? Number(row.workDuration) : null,
      };
    });

    const importResult = await importKartes(importRows);
    setResult(importResult);
    setStep("done");
  }

  return (
    <main className="flex-1 p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">CSVインポート</h1>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {step === "upload" && (
        <div>
          <p className="mb-4 text-zinc-600">
            Google FormsからエクスポートしたカルテのCSVファイルを選択してください。
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      )}

      {step === "preview" && (
        <div>
          <p className="mb-4">{rows.length}件のカルテデータを検出しました。</p>
          <div className="mb-4 max-h-64 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-100">
                <tr>
                  <th className="p-2 text-left">日時</th>
                  <th className="p-2 text-left">氏名</th>
                  <th className="p-2 text-left">トラブル</th>
                  <th className="p-2 text-left">担当</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{row.timestamp}</td>
                    <td className="p-2">{row.name}</td>
                    <td className="p-2 max-w-xs truncate">{row.troubleDetails}</td>
                    <td className="p-2">{row.assignee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handlePreviewConfirm}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            インポート開始
          </button>
        </div>
      )}

      {step === "memberMapping" && (
        <div>
          <p className="mb-4">
            以下の担当者が自動マッチできませんでした。対応するメンバーを選択してください。
          </p>
          {unmatchedAssignees.map((assigneeId) => (
            <div key={assigneeId} className="mb-3">
              <label className="block text-sm font-medium mb-1">担当者: {assigneeId}</label>
              <select
                className="w-full rounded border p-2"
                value={memberMapping.get(assigneeId) ?? ""}
                onChange={(e) => handleMemberSelect(assigneeId, e.target.value)}
              >
                <option value="">スキップ</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.studentId})
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            onClick={handleMappingConfirm}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            確定してインポート
          </button>
        </div>
      )}

      {step === "importing" && <p className="text-zinc-500">インポート中...</p>}

      {step === "done" && result && (
        <div>
          <div className="mb-4 rounded border border-green-300 bg-green-50 p-4">
            <p className="font-medium">インポート完了</p>
            <p>
              成功: {result.succeeded}/{result.total}
            </p>
            {result.failed.length > 0 && (
              <p className="text-red-600">失敗: {result.failed.length}</p>
            )}
          </div>
          {result.failed.length > 0 && (
            <div className="rounded border p-4">
              <p className="font-medium mb-2">失敗した行:</p>
              {result.failed.map((f) => (
                <p key={f.index} className="text-sm text-red-600">
                  行 {f.index + 2}: {f.error}
                </p>
              ))}
            </div>
          )}
          <a href="/kartes" className="mt-4 inline-block text-blue-600 hover:underline">
            カルテ一覧へ →
          </a>
        </div>
      )}
    </main>
  );
}
