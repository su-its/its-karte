"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { parseCsv, type CsvRow } from "../model/parse-csv";
import { parseCategoryTags } from "../model/tag-mapping";
import { listMembers, listKartesWithMembers, listCategories } from "@/shared/api";
import { importKartes, type ImportResult } from "../api/import.server";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { DuplicateComparison } from "./duplicate-comparison";
import { CheckCircle2Icon, AlertCircleIcon, LoaderIcon, ArrowLeftIcon } from "lucide-react";
import { Stepper } from "./stepper";
import { DropZone } from "@/shared/ui/drop-zone";
import { ValidationStep } from "./validation-step";
import { DuplicateStep } from "./duplicate-step";
import { KarteForm, type KarteFormValues } from "@/widgets/karte-form";
import type { CategoryOption, MemberOption } from "@/shared/api";
import {
  type MemberInfo,
  type ExistingKarte,
  parseGradeType,
  fingerprintsFromKarte,
  findDuplicateMatches,
  csvRowToTableRow,
  csvRowToFormValues,
  csvErrorFieldsToEditableFields,
  formFieldToCsvField,
  formValuesToCsvRow,
  buildComparisonFields,
  exportErrorCsv,
  getErrorFields,
  validateRow,
} from "../model/helpers";

type Step = "upload" | "validation" | "duplicates" | "importing" | "done";

export function KarteImportPage() {
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
  /** 行index → ユーザーが「未記録として登録」を選んだフィールド */
  const [notRecordedFieldsMap, setNotRecordedFieldsMap] = useState<Map<number, Set<keyof CsvRow>>>(
    new Map(),
  );

  const karteFingerprints = useMemo(
    () => existingKartes.map(fingerprintsFromKarte),
    [existingKartes],
  );

  const tableRows = useMemo(
    () =>
      rows.map((row, i) => {
        const nrFields = notRecordedFieldsMap.get(i);
        const tr = csvRowToTableRow(row, i, memberMapping, members, nrFields);
        if (initialErrorIndices.has(i) && !tr.error) tr.fixed = true;
        return tr;
      }),
    [rows, memberMapping, members, initialErrorIndices, notRecordedFieldsMap],
  );

  const errorIndices = useMemo(
    () => new Set(tableRows.filter((r) => r.error).map((r) => Number(r.id))),
    [tableRows],
  );
  // ナビゲーション用: 現在エラーがある行のリスト（修正済みは除外）
  const navErrorList = useMemo(() => [...errorIndices].sort((a, b) => a - b), [errorIndices]);
  const validCount = tableRows.length - errorIndices.size;

  /** ユニークな未解決担当者名 → 出現行数 */
  const unresolvedAssignees = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const names = row.assignee
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      for (const name of names) {
        if (!memberMapping.has(name)) {
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [rows, memberMapping]);

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

      setMemberMapping(new Map());

      // Capture initial errors before user edits
      const initErrors = new Set<number>();
      for (let i = 0; i < parsed.length; i++) {
        if (validateRow(parsed[i], undefined)) initErrors.add(i);
      }
      setInitialErrorIndices(initErrors);
      setStep("validation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSVの読み込みに失敗しました");
    }
  }

  function handleFileFromDrop(file: File) {
    void processFile(file);
  }

  const [originalFormValues, setOriginalFormValues] = useState<
    Partial<KarteFormValues> | undefined
  >(undefined);

  function openRowEditor(index: number) {
    const nrFields = notRecordedFieldsMap.get(index);
    const errorFields = getErrorFields(rows[index], nrFields);
    setEditingRowIndex(index);
    setFrozenEditableFields(errorFields);
    setOriginalFormValues(csvRowToFormValues(rows[index], memberMapping));
  }

  function markFieldNotRecorded(rowIndex: number, field: keyof CsvRow) {
    setNotRecordedFieldsMap((prev) => {
      const next = new Map(prev);
      const fields = new Set(next.get(rowIndex) ?? []);
      fields.add(field);
      next.set(rowIndex, fields);
      return next;
    });
    // フィールドを空にする
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, [field]: "" } : row)));
  }

  function closeRowEditor() {
    setEditingRowIndex(null);
    setFrozenEditableFields(new Set());
    setOriginalFormValues(undefined);
  }

  function startErrorFlow() {
    if (navErrorList.length > 0) openRowEditor(navErrorList[0]);
  }

  function goToNextError() {
    if (editingRowIndex === null) return;
    const next = navErrorList.find((i) => i > editingRowIndex);
    if (next !== undefined) {
      openRowEditor(next);
    } else {
      closeRowEditor();
    }
  }

  function goToPrevError() {
    if (editingRowIndex === null) return;
    const prev = [...navErrorList].reverse().find((i) => i < editingRowIndex);
    if (prev !== undefined) {
      openRowEditor(prev);
    }
  }

  function resolveAssignee(unresolvedName: string, memberId: string) {
    setMemberMapping((prev) => {
      const next = new Map(prev);
      next.set(unresolvedName, memberId);
      return next;
    });
  }

  function proceedFromValidation() {
    if (duplicateMap.size > 0) {
      setSkippedIndices(new Set(duplicateMap.keys()));
      setStep("duplicates");
    } else {
      void handleImport(new Set());
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
        recordedAt: /\d{4}.\d{2}.\d{2}.\d{2}/.test(row.timestamp)
          ? new Date(row.timestamp.replace(/\//g, "-")).toISOString()
          : new Date().toISOString(),
        consultedAt: row.date || row.timestamp || null,
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
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.name,
        studentId: m.studentId,
        department: m.department,
        email: m.email,
      })),
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
        <ValidationStep
          tableRows={tableRows}
          errorCount={errorIndices.size}
          validCount={validCount}
          hasDuplicates={duplicateMap.size > 0}
          unresolvedAssignees={unresolvedAssignees}
          members={members}
          onStartErrorFlow={startErrorFlow}
          onExportAndProceed={() => {
            exportErrorCsv(rows, errorIndices);
            proceedFromValidation();
          }}
          onProceed={proceedFromValidation}
          onRowClick={(_, index) => openRowEditor(index)}
          onResolveAssignee={resolveAssignee}
        />
      )}

      {/* Duplicate Review */}
      {step === "duplicates" && (
        <DuplicateStep
          rows={rows}
          duplicateMap={duplicateMap}
          skippedIndices={skippedIndices}
          expandedDuplicates={expandedDuplicates}
          importableCount={importableCount}
          onToggleSkip={toggleSkip}
          onExpandDuplicates={(idx) => setExpandedDuplicates((prev) => new Set(prev).add(idx))}
          onBack={() => setStep("validation")}
          onImport={() => handleImport()}
        />
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
              {frozenEditableFields.size > 0 && (
                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" onClick={goToPrevError}>
                    <ArrowLeftIcon data-icon="inline-start" /> 前のエラー
                  </Button>
                  {editingTableRow?.error ? (
                    <Button variant="outline" size="sm" disabled>
                      エラーを修正してください
                    </Button>
                  ) : errorIndices.size > 0 ? (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={goToNextError}
                    >
                      <CheckCircle2Icon data-icon="inline-start" />
                      次のエラーへ（残り{errorIndices.size}件）
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={closeRowEditor}
                    >
                      <CheckCircle2Icon data-icon="inline-start" />
                      すべて解決しました
                    </Button>
                  )}
                </div>
              )}
              <KarteForm
                key={editingRowIndex}
                members={formMembers}
                categories={formCategories}
                initialValues={csvRowToFormValues(editingRow, memberMapping)}
                editableFields={formEditableFields}
                originalValues={originalFormValues}
                onMarkNotRecorded={(formField) => {
                  if (editingRowIndex === null) return;
                  const csvField = formFieldToCsvField(formField);
                  if (csvField) markFieldNotRecorded(editingRowIndex, csvField);
                }}
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
