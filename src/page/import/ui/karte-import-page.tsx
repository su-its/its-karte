"use client";

import { useReducer, useMemo } from "react";
import Link from "next/link";
import { parseCsv } from "../model/parse-csv";
import { parseCategoryTags } from "../model/tag-mapping";
import { listMembers, listKartesWithMembers, listCategories } from "@/shared/api";
import { importKartes } from "../api/import.server";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { DuplicateComparison } from "./duplicate-comparison";
import { CheckCircle2Icon, AlertCircleIcon, LoaderIcon } from "lucide-react";
import { Stepper } from "./stepper";
import { DropZone } from "@/shared/ui/drop-zone";
import { ValidationStep } from "./validation-step";
import { DuplicateStep } from "./duplicate-step";
import { ErrorNavFooter } from "./error-nav-footer";
import { KarteForm } from "@/widgets/karte-form";
import type { MemberOption } from "@/shared/api";
import {
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
import { importReducer, INITIAL_STATE } from "../model/import-state";

export function KarteImportPage() {
  const [state, dispatch] = useReducer(importReducer, INITIAL_STATE);

  const {
    step,
    rows,
    members,
    memberMapping,
    existingKartes,
    formCategories,
    result,
    error,
    initialErrorIndices,
    notRecordedFieldsMap,
    editingRowIndex,
    frozenEditableFields,
    originalFormValues,
    skippedIndices,
    comparingIndex,
    expandedDuplicates,
  } = state;

  // --- Derived values ---

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

  const navErrorList = useMemo(() => [...errorIndices].sort((a, b) => a - b), [errorIndices]);
  const validCount = tableRows.length - errorIndices.size;

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

  const formEditableFields = useMemo(
    () => csvErrorFieldsToEditableFields(frozenEditableFields),
    [frozenEditableFields],
  );

  const editingRow = editingRowIndex !== null ? rows[editingRowIndex] : null;
  const editingTableRow = editingRowIndex !== null ? tableRows[editingRowIndex] : null;
  const comparingRow = comparingIndex !== null ? rows[comparingIndex] : null;
  const comparingMatches = comparingIndex !== null ? (duplicateMap.get(comparingIndex) ?? []) : [];
  const importableCount =
    validCount - [...skippedIndices].filter((i) => !errorIndices.has(i)).length;
  const stepIndex =
    step === "upload" ? 0 : step === "validation" ? 1 : step === "duplicates" ? 2 : 3;

  // --- Handlers ---

  async function processFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      const [memberList, kartes, categories] = await Promise.all([
        listMembers(),
        listKartesWithMembers(),
        listCategories(),
      ]);

      const initErrors = new Set<number>();
      for (let i = 0; i < parsed.length; i++) {
        if (validateRow(parsed[i], undefined)) initErrors.add(i);
      }

      dispatch({
        type: "FILE_LOADED",
        rows: parsed,
        members: memberList,
        kartes,
        categories,
        initialErrors: initErrors,
      });
    } catch (err) {
      dispatch({
        type: "FILE_ERROR",
        error: err instanceof Error ? err.message : "CSVの読み込みに失敗しました",
      });
    }
  }

  function openRowEditor(index: number) {
    const nrFields = notRecordedFieldsMap.get(index);
    dispatch({
      type: "OPEN_EDITOR",
      index,
      errorFields: getErrorFields(rows[index], nrFields),
      formValues: csvRowToFormValues(rows[index], memberMapping),
    });
  }

  function closeRowEditor() {
    dispatch({ type: "CLOSE_EDITOR" });
  }

  function goToNextError() {
    if (editingRowIndex === null) return;
    const next = navErrorList.find((i) => i > editingRowIndex);
    if (next !== undefined) openRowEditor(next);
    else closeRowEditor();
  }

  function goToPrevError() {
    if (editingRowIndex === null) return;
    const prev = [...navErrorList].reverse().find((i) => i < editingRowIndex);
    if (prev !== undefined) openRowEditor(prev);
  }

  function proceedFromValidation() {
    if (duplicateMap.size > 0) {
      dispatch({ type: "PROCEED_TO_DUPLICATES", skipIndices: new Set(duplicateMap.keys()) });
    } else {
      void handleImport(new Set());
    }
  }

  async function handleImport(skipSet?: Set<number>) {
    dispatch({ type: "START_IMPORT" });
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
    dispatch({ type: "IMPORT_DONE", result: importResult });
  }

  // --- Render ---

  return (
    <main className="flex-1 px-8 py-8 w-full">
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

      {step === "upload" && <DropZone onFile={(file) => void processFile(file)} />}

      {step === "validation" && (
        <ValidationStep
          tableRows={tableRows}
          errorCount={errorIndices.size}
          validCount={validCount}
          hasDuplicates={duplicateMap.size > 0}
          unresolvedAssignees={unresolvedAssignees}
          members={members}
          onStartErrorFlow={() => navErrorList.length > 0 && openRowEditor(navErrorList[0])}
          onExportAndProceed={() => {
            exportErrorCsv(rows, errorIndices);
            proceedFromValidation();
          }}
          onProceed={proceedFromValidation}
          onRowClick={(_, index) => openRowEditor(index)}
          onResolveAssignee={(name, memberId) =>
            dispatch({ type: "RESOLVE_ASSIGNEE", name, memberId })
          }
        />
      )}

      {step === "duplicates" && (
        <DuplicateStep
          rows={rows}
          duplicateMap={duplicateMap}
          skippedIndices={skippedIndices}
          expandedDuplicates={expandedDuplicates}
          importableCount={importableCount}
          onToggleSkip={(idx) => dispatch({ type: "TOGGLE_SKIP", index: idx })}
          onExpandDuplicates={(idx) => dispatch({ type: "EXPAND_DUPLICATES", index: idx })}
          onBack={() => dispatch({ type: "BACK_TO_VALIDATION" })}
          onImport={() => handleImport()}
        />
      )}

      {step === "importing" && (
        <div className="flex items-center justify-center gap-2 py-16">
          <LoaderIcon className="animate-spin" />
          <span className="text-muted-foreground">インポート中...</span>
        </div>
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
                <ErrorNavFooter
                  hasError={!!editingTableRow?.error}
                  remainingErrors={errorIndices.size}
                  onPrev={goToPrevError}
                  onNext={goToNextError}
                  onClose={closeRowEditor}
                />
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
                  if (csvField)
                    dispatch({
                      type: "MARK_NOT_RECORDED",
                      rowIndex: editingRowIndex,
                      field: csvField,
                    });
                }}
                onFormChange={(formVals) => {
                  const updated = formValuesToCsvRow(formVals, editingRow, members);
                  dispatch({ type: "UPDATE_ROW", index: editingRowIndex, row: updated });
                }}
              />

              {frozenEditableFields.size > 0 && (
                <div className="flex flex-col gap-2 pt-4">
                  <ErrorNavFooter
                    hasError={!!editingTableRow?.error}
                    remainingErrors={errorIndices.size}
                    onPrev={goToPrevError}
                    onNext={goToNextError}
                    onClose={closeRowEditor}
                  />
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
      <Sheet
        open={comparingIndex !== null}
        onOpenChange={() => dispatch({ type: "SET_COMPARING", index: null })}
      >
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
                      dispatch({ type: "TOGGLE_SKIP", index: comparingIndex });
                    dispatch({ type: "SET_COMPARING", index: null });
                  }}
                >
                  スキップする
                </Button>
                <Button
                  onClick={() => {
                    if (comparingIndex !== null && skippedIndices.has(comparingIndex))
                      dispatch({ type: "TOGGLE_SKIP", index: comparingIndex });
                    dispatch({ type: "SET_COMPARING", index: null });
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
