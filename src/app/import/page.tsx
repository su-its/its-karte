"use client";

import { useState } from "react";
import Link from "next/link";
import { parseCsv, type CsvRow } from "@/lib/parseCsv";
import { listMembers } from "@/actions/karte";
import { importKartes, type ImportResult } from "@/actions/import";
import type { ConsultationCategoryId } from "@shizuoka-its/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2Icon, AlertCircleIcon, UploadIcon, LoaderIcon } from "lucide-react";

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
      setError(null);
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
    <main className="flex-1 p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">CSVインポート</h1>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircleIcon />
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>CSVファイルを選択</CardTitle>
            <CardDescription>
              Google FormsからエクスポートしたカルテのCSVファイルをアップロードしてください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input type="file" accept=".csv" onChange={handleFileUpload} />
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>プレビュー</CardTitle>
            <CardDescription>
              <Badge variant="secondary">{rows.length}件</Badge> のカルテデータを検出しました。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日時</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>トラブル</TableHead>
                    <TableHead>担当</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{row.timestamp}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.troubleDetails}</TableCell>
                      <TableCell>{row.assignee}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handlePreviewConfirm}>
              <UploadIcon data-icon="inline-start" />
              インポート開始
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "memberMapping" && (
        <Card>
          <CardHeader>
            <CardTitle>担当者のマッチング</CardTitle>
            <CardDescription>
              以下の担当者が自動マッチできませんでした。対応するメンバーを選択してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {unmatchedAssignees.map((assigneeId) => (
              <Field key={assigneeId}>
                <FieldLabel>担当者: {assigneeId}</FieldLabel>
                <Select
                  value={memberMapping.get(assigneeId) ?? ""}
                  onValueChange={(value) => {
                    if (value) handleMemberSelect(assigneeId, value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="スキップ" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.studentId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ))}
            <Button onClick={handleMappingConfirm}>確定してインポート</Button>
          </CardContent>
        </Card>
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 justify-center">
            <LoaderIcon className="animate-spin" />
            <span className="text-muted-foreground">インポート中...</span>
          </CardContent>
        </Card>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-4">
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>インポート完了</AlertTitle>
            <AlertDescription>
              成功: {result.succeeded}/{result.total}
              {result.failed.length > 0 && ` / 失敗: ${result.failed.length}`}
            </AlertDescription>
          </Alert>

          {result.failed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>失敗した行</CardTitle>
              </CardHeader>
              <CardContent>
                {result.failed.map((f) => (
                  <p key={f.index} className="text-sm text-destructive">
                    行 {f.index + 2}: {f.error}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <Button variant="outline" render={<Link href="/" />}>
            カルテ一覧へ →
          </Button>
        </div>
      )}
    </main>
  );
}
