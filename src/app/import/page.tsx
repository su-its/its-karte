"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { parseCsv, type CsvRow } from "@/lib/parseCsv";
import { listMembers, listKartesWithMembers, listCategories } from "@/actions/karte";
import { importKartes, type ImportResult } from "@/actions/import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { KarteTable } from "@/components/karte-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DuplicateComparison } from "@/components/duplicate-comparison";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  UploadIcon,
  LoaderIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  DownloadIcon,
} from "lucide-react";
import { Stepper } from "@/components/stepper";
import {
  KarteForm,
  type KarteFormValues,
  type CategoryOption,
  type MemberOption,
} from "@/components/karte-form";
import {
  type MemberInfo,
  type ExistingKarte,
  parseGradeType,
  parseCategoryTags,
  fingerprintsFromKarte,
  findDuplicateMatches,
  csvRowToTableRow,
  csvRowToFormValues,
  csvErrorFieldsToEditableFields,
  formValuesToCsvRow,
  buildComparisonFields,
  exportErrorCsv,
  getErrorFields,
  validateRow,
} from "./helpers";

type Step = "upload" | "validation" | "duplicates" | "importing" | "done";

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [memberMapping, setMemberMapping] = useState<Map<string, string>>(new Map());
  const [existingKartes, setExistingKartes] = useState<ExistingKarte[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(new Set());
  const [comparingIndex, setComparingIndex] = useState<number | null>(null);
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<number>>(new Set());
  const [initialErrorIndices, setInitialErrorIndices] = useState<Set<number>>(new Set());

  const karteFingerprints = useMemo(
    () => existingKartes.map(fingerprintsFromKarte),
    [existingKartes],
  );

  const tableRows = useMemo(
    () =>
      rows.map((row, i) => {
        const tr = csvRowToTableRow(row, i, memberMapping, members);
        if (initialErrorIndices.has(i) && !tr.error) tr.fixed = true;
        return tr;
      }),
    [rows, memberMapping, members, initialErrorIndices],
  );

  const errorIndices = useMemo(
    () => new Set(tableRows.filter((r) => r.error).map((r) => Number(r.id))),
    [tableRows],
  );
  // ナビゲーション用: 初期エラー行リスト（修正しても消えない）
  const navErrorList = useMemo(
    () => [...initialErrorIndices].sort((a, b) => a - b),
    [initialErrorIndices],
  );
  const validCount = tableRows.length - errorIndices.size;

  const duplicateMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof findDuplicateMatches>>();
    for (let i = 0; i < rows.length; i++) {
      if (errorIndices.has(i)) continue;
      const matches = findDuplicateMatches(rows[i], existingKartes, karteFingerprints);
      if (matches.length > 0) map.set(i, matches);
    }
    return map;
  }, [rows, existingKartes, karteFingerprints, errorIndices]);

  // ---- Handlers ----

  async function processFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setError(null);

      const [memberList, kartes, categories] = await Promise.all([
        listMembers(),
        listKartesWithMembers(),
        listCategories(),
      ]);
      setMembers(memberList);
      setExistingKartes(kartes);
      setFormCategories(categories);

      const mapping = new Map<string, string>();
      const allAssigneeIds = new Set<string>();
      for (const row of parsed) {
        for (const id of row.assignee
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)) {
          allAssigneeIds.add(id);
        }
      }
      for (const assigneeId of allAssigneeIds) {
        // 学籍番号で一致
        const byStudentId = memberList.find((m) => m.studentId === assigneeId);
        if (byStudentId) {
          mapping.set(assigneeId, byStudentId.id);
          continue;
        }
        // 名前の部分一致で候補が1人に絞れたらマッチ
        const nameMatches = memberList.filter((m) => m.name.includes(assigneeId));
        if (nameMatches.length === 1) mapping.set(assigneeId, nameMatches[0].id);
      }
      setMemberMapping(mapping);

      // Capture initial errors before user edits
      const initErrors = new Set<number>();
      for (let i = 0; i < parsed.length; i++) {
        if (validateRow(parsed[i], i, mapping)) initErrors.add(i);
      }
      setInitialErrorIndices(initErrors);
      setStep("validation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSVの読み込みに失敗しました");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleFileFromDrop(file: File) {
    processFile(file);
  }

  function openRowEditor(index: number) {
    const errorFields = getErrorFields(rows[index], memberMapping);
    setEditingRowIndex(index);
    setFrozenEditableFields(errorFields);
  }

  function closeRowEditor() {
    setEditingRowIndex(null);
    setFrozenEditableFields(new Set());
  }

  function startErrorFlow() {
    if (navErrorList.length > 0) openRowEditor(navErrorList[0]);
  }

  function goToNextError() {
    if (editingRowIndex === null) return;
    const currentPos = navErrorList.indexOf(editingRowIndex);
    const next = navErrorList[currentPos + 1];
    if (next !== undefined) {
      openRowEditor(next);
    } else {
      closeRowEditor();
    }
  }

  function goToPrevError() {
    if (editingRowIndex === null) return;
    const currentPos = navErrorList.indexOf(editingRowIndex);
    const prev = navErrorList[currentPos - 1];
    if (prev !== undefined) {
      openRowEditor(prev);
    }
  }

  function proceedFromValidation() {
    if (duplicateMap.size > 0) {
      setSkippedIndices(new Set(duplicateMap.keys()));
      setStep("duplicates");
    } else {
      handleImport(new Set());
    }
  }

  function toggleSkip(index: number) {
    setSkippedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleImport(skipSet?: Set<number>) {
    setStep("importing");
    const toSkip = skipSet ?? skippedIndices;
    const validRows = rows.filter((_, i) => !errorIndices.has(i) && !toSkip.has(i));
    const importRows = validRows.map((row) => {
      const gradeType = parseGradeType(row.grade);
      const rawAssignees = row.assignee
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const resolvedMemberIds: string[] = [];
      const unresolvedAssigneeNames: string[] = [];
      for (const name of rawAssignees) {
        const mid = memberMapping.get(name);
        if (mid) resolvedMemberIds.push(mid);
        else unresolvedAssigneeNames.push(name);
      }
      const client: Parameters<typeof importKartes>[0][number]["client"] =
        gradeType === "staff"
          ? { type: "staff", name: row.name }
          : gradeType === "teacher"
            ? { type: "teacher", name: row.name }
            : gradeType === "other"
              ? { type: "other", name: row.name }
              : row.name || row.studentId
                ? {
                    type: "student",
                    studentId: row.studentId,
                    name: row.name,
                    faculty: row.faculty,
                    department: row.department,
                    grade: row.grade,
                  }
                : null;
      return {
        recordedAt: new Date(row.timestamp.replace(/\//g, "-")).toISOString(),
        consultedAt: new Date((row.date || row.timestamp).replace(/\//g, "-")).toISOString(),
        client,
        consent: {
          liabilityConsent:
            row.liabilityConsent === "同意する" || row.liabilityConsent === "同意あり",
          disclosureConsent:
            row.disclosureConsent === "同意する" || row.disclosureConsent === "同意あり",
        },
        categories: parseCategoryTags(row.categoryTags),
        targetDevice: row.targetDevice,
        troubleDetails: row.troubleDetails,
        resolvedMemberIds,
        unresolvedAssigneeNames,
        supportContent: row.supportContent,
        resolution:
          row.resolution === "解決" ? "resolved" : row.resolution === "未解決" ? "unresolved" : "",
        followUp: row.followUp || null,
        workDurationMinutes: row.workDuration ? Number(row.workDuration) : null,
      };
    });
    const importResult = await importKartes(importRows as Parameters<typeof importKartes>[0]);
    setResult(importResult);
    setStep("done");
  }

  const editingRow = editingRowIndex !== null ? rows[editingRowIndex] : null;
  const editingTableRow = editingRowIndex !== null ? tableRows[editingRowIndex] : null;

  const formMembers: MemberOption[] = useMemo(
    () => members.map((m) => ({ id: m.id, name: m.name, studentId: m.studentId })),
    [members],
  );
  const [formCategories, setFormCategories] = useState<CategoryOption[]>([]);

  // シートを開いた時点のエラーフィールドを固定（編集中に消えないように）
  const [frozenEditableFields, setFrozenEditableFields] = useState<Set<keyof CsvRow>>(new Set());
  const formEditableFields = useMemo(
    () => csvErrorFieldsToEditableFields(frozenEditableFields),
    [frozenEditableFields],
  );
  const comparingRow = comparingIndex !== null ? rows[comparingIndex] : null;
  const comparingMatches = comparingIndex !== null ? (duplicateMap.get(comparingIndex) ?? []) : [];
  const importableCount =
    validCount - [...skippedIndices].filter((i) => !errorIndices.has(i)).length;

  const stepIndex =
    step === "upload" ? 0 : step === "validation" ? 1 : step === "duplicates" ? 2 : 3;

  return (
    <main className="flex-1 px-8 py-8 w-full">
      {/* Header + Stepper */}
      <div className="flex flex-col gap-6 mb-8">
        <h1 className="text-2xl font-bold">CSVインポート</h1>

        {step !== "done" && (
          <Stepper
            steps={[
              { label: "CSVアップロード" },
              { label: "データ検証・修正" },
              { label: "重複確認" },
              { label: "インポート実行" },
            ]}
            currentStep={stepIndex}
          />
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircleIcon />
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload */}
      {step === "upload" && <DropZone onFile={handleFileFromDrop} />}

      {/* Validation */}
      {step === "validation" && (
        <div className="flex flex-col gap-4">
          {/* Status banner + action */}
          {errorIndices.size > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircleIcon className="size-5 text-destructive shrink-0" />
                <div>
                  <p className="font-semibold">{errorIndices.size}件のデータにエラーがあります</p>
                  <p className="text-sm text-muted-foreground">
                    赤くハイライトされた行をクリックして修正してください。すべて解決すると次に進めます。
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-2 text-sm">
                  <Badge variant="secondary">{validCount}件 正常</Badge>
                  <Badge variant="destructive">{errorIndices.size}件 エラー</Badge>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button size="lg" onClick={startErrorFlow}>
                    エラーを修正する（残り{errorIndices.size}件）
                  </Button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                    onClick={() => {
                      exportErrorCsv(rows, errorIndices);
                      proceedFromValidation();
                    }}
                  >
                    エラー行をCSV出力して正常行だけで進む
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2Icon className="size-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold">全{validCount}件のデータが正常です</p>
                  <p className="text-sm text-muted-foreground">
                    問題なければ次のステップへ進んでください。
                  </p>
                </div>
              </div>
              <Button size="lg" onClick={proceedFromValidation}>
                {duplicateMap.size > 0 ? (
                  <>
                    重複確認へ進む <ArrowRightIcon data-icon="inline-end" />
                  </>
                ) : (
                  <>
                    <UploadIcon data-icon="inline-start" /> {validCount}件をインポート
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Table */}
          <KarteTable kartes={tableRows} onRowClick={(_, index) => openRowEditor(index)} />
        </div>
      )}

      {/* Duplicate Review */}
      {step === "duplicates" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircleIcon className="size-5 text-yellow-600 shrink-0" />
              <div>
                <p className="font-semibold">{duplicateMap.size}件の重複候補が見つかりました</p>
                <p className="text-sm text-muted-foreground">
                  CSVデータと既存レコードを比較して、インポートするかスキップするか判断してください。
                </p>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              <Badge variant="secondary">{importableCount}件 インポート</Badge>
              <Badge variant="outline">{skippedIndices.size}件 スキップ</Badge>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ソース</TableHead>
                <TableHead className="whitespace-nowrap">相談日</TableHead>
                <TableHead className="whitespace-nowrap">相談者</TableHead>
                <TableHead>トラブル詳細</TableHead>
                <TableHead>対応内容</TableHead>
                <TableHead className="whitespace-nowrap">担当者</TableHead>
                <TableHead className="w-28">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...duplicateMap.entries()].map(([csvIndex, matches]) => {
                const row = rows[csvIndex];
                const isSkipped = skippedIndices.has(csvIndex);
                const topMatchFields = new Set(matches.flatMap((m) => m.matchedFields));
                const visibleMatches = expandedDuplicates.has(csvIndex)
                  ? matches
                  : matches.slice(0, 2);
                const hasMore = matches.length > 2 && !expandedDuplicates.has(csvIndex);

                return (
                  <DuplicateRowGroup key={csvIndex}>
                    {/* CSV row */}
                    <TableRow
                      className={cn("border-b-0", isSkipped ? "opacity-50" : "bg-background")}
                    >
                      <TableCell className="text-xs font-semibold">CSV 行{csvIndex + 2}</TableCell>
                      <DupCell value={row.date} highlight={topMatchFields.has("nameDate")} />
                      <DupCell value={row.name} highlight={topMatchFields.has("nameDate")} />
                      <DupCell
                        value={row.troubleDetails}
                        highlight={topMatchFields.has("trouble")}
                        truncate
                      />
                      <DupCell
                        value={row.supportContent}
                        highlight={topMatchFields.has("support")}
                        truncate
                      />
                      <TableCell className="text-sm">{row.assignee}</TableCell>
                      <TableCell>
                        <Button
                          variant={isSkipped ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => toggleSkip(csvIndex)}
                        >
                          {isSkipped ? "インポート" : "スキップ"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {/* DB matches */}
                    {visibleMatches.map((match) => {
                      const k = match.existingKarte;
                      const mf = new Set(match.matchedFields);
                      const clientName = k.client.type === "recorded" ? k.client.value.name : "";
                      const date =
                        k.consultedAt.type === "recorded"
                          ? new Date(k.consultedAt.value).toLocaleDateString("ja-JP")
                          : "";
                      return (
                        <TableRow key={k.id} className="bg-muted/30 border-b-0">
                          <TableCell className="text-xs text-muted-foreground">既存</TableCell>
                          <DupCell value={date} highlight={mf.has("nameDate")} />
                          <DupCell value={clientName} highlight={mf.has("nameDate")} />
                          <DupCell
                            value={k.consultation.troubleDetails}
                            highlight={mf.has("trouble")}
                            truncate
                          />
                          <DupCell
                            value={k.supportRecord.content}
                            highlight={mf.has("support")}
                            truncate
                          />
                          <TableCell className="text-sm">
                            {k.assignedMemberNames.join(", ")}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      );
                    })}
                    {hasMore && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={7} className="text-center">
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline hover:text-foreground"
                            onClick={() =>
                              setExpandedDuplicates((prev) => new Set(prev).add(csvIndex))
                            }
                          >
                            他{matches.length - 2}件の候補を表示
                          </button>
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Spacer */}
                    <TableRow className="h-2 border-b">
                      <TableCell colSpan={7} className="p-0" />
                    </TableRow>
                  </DuplicateRowGroup>
                );
              })}
            </TableBody>
          </Table>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <Button variant="outline" onClick={() => setStep("validation")}>
              <ArrowLeftIcon data-icon="inline-start" /> データ検証に戻る
            </Button>
            <Button size="lg" onClick={() => handleImport()}>
              <UploadIcon data-icon="inline-start" /> {importableCount}件をインポート
            </Button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === "importing" && (
        <div className="flex items-center justify-center gap-2 py-16">
          <LoaderIcon className="animate-spin" />
          <span className="text-muted-foreground">インポート中...</span>
        </div>
      )}

      {/* Done */}
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
                <CardTitle>保存に失敗した行</CardTitle>
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
          <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
            カルテ一覧へ →
          </Button>
        </div>
      )}

      {/* Sheet: Validation Edit */}
      <Sheet open={editingRowIndex !== null} onOpenChange={() => closeRowEditor()}>
        <SheetContent className="overflow-y-auto p-8">
          <SheetHeader>
            <SheetTitle>行 {editingRowIndex !== null ? editingRowIndex + 2 : ""} の編集</SheetTitle>
            <SheetDescription>
              {editingTableRow?.error ? (
                <span className="text-destructive">{editingTableRow.error}</span>
              ) : (
                <span className="text-green-600">この行は正常です</span>
              )}
            </SheetDescription>
          </SheetHeader>
          {editingRow && editingRowIndex !== null && (
            <div className="flex flex-col gap-4 mt-6">
              <KarteForm
                members={formMembers}
                categories={formCategories}
                initialValues={csvRowToFormValues(editingRow, memberMapping)}
                editableFields={formEditableFields}
                onFormChange={(formVals) => {
                  const updated = formValuesToCsvRow(formVals, editingRow, members);
                  setRows((prev) => prev.map((r, i) => (i === editingRowIndex ? updated : r)));
                }}
              />

              {/* Action footer */}
              {frozenEditableFields.size > 0 && (
                <div className="flex flex-col gap-2 pt-4">
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={goToPrevError}>
                      <ArrowLeftIcon data-icon="inline-start" /> 前のエラー
                    </Button>
                    {editingTableRow?.error ? (
                      <Button variant="outline" disabled>
                        エラーを修正してください
                      </Button>
                    ) : errorIndices.size > 0 ? (
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={goToNextError}
                      >
                        <CheckCircle2Icon data-icon="inline-start" />
                        次のエラーへ（残り{errorIndices.size}件）
                      </Button>
                    ) : (
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={closeRowEditor}
                      >
                        <CheckCircle2Icon data-icon="inline-start" />
                        すべて解決しました
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                      onClick={errorIndices.size > 1 ? goToNextError : closeRowEditor}
                    >
                      {errorIndices.size > 1 ? "修正せず次へ →" : "修正せず閉じる →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: Duplicate Comparison */}
      <Sheet open={comparingIndex !== null} onOpenChange={() => setComparingIndex(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              重複の確認 — 行 {comparingIndex !== null ? comparingIndex + 2 : ""}
            </SheetTitle>
            <SheetDescription>
              CSVデータと既存レコードを比較して、インポートするか判断してください。
            </SheetDescription>
          </SheetHeader>
          {comparingRow && comparingIndex !== null && comparingMatches.length > 0 && (
            <div className="flex flex-col gap-6 mt-6">
              {comparingMatches.map((match, matchIdx) => (
                <div key={match.existingKarte.id}>
                  {comparingMatches.length > 1 && (
                    <h3 className="text-sm font-medium mb-2">
                      候補 {matchIdx + 1} / {comparingMatches.length}
                    </h3>
                  )}
                  <DuplicateComparison
                    fields={buildComparisonFields(
                      comparingRow,
                      match.existingKarte,
                      match.matchedFields,
                    )}
                    matchedFieldKeys={match.matchedFields}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (comparingIndex !== null && !skippedIndices.has(comparingIndex))
                      toggleSkip(comparingIndex);
                    setComparingIndex(null);
                  }}
                >
                  スキップする
                </Button>
                <Button
                  onClick={() => {
                    if (comparingIndex !== null && skippedIndices.has(comparingIndex))
                      toggleSkip(comparingIndex);
                    setComparingIndex(null);
                  }}
                >
                  インポートする
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function DuplicateRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DupCell({
  value,
  highlight,
  truncate,
}: {
  value: string;
  highlight?: boolean;
  truncate?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-sm",
        highlight && "bg-yellow-100 dark:bg-yellow-900/30",
        truncate && "max-w-48",
      )}
    >
      {truncate ? (
        <div className="truncate">{value}</div>
      ) : (
        value || <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  );
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) onFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center py-24 gap-4 cursor-pointer rounded-xl border-2 border-dashed transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <UploadIcon className={cn("size-12", dragging ? "text-primary" : "text-muted-foreground")} />
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-1">
          {dragging ? "ここにドロップ" : "CSVファイルをドラッグ＆ドロップ"}
        </h2>
        <p className="text-muted-foreground">またはクリックしてファイルを選択</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
