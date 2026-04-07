import type { CsvRow } from "./parse-csv";
import type { MemberInfo, ExistingKarte } from "./helpers";
import type { KarteFormValues } from "@/widgets/karte-form";
import type { CategoryOption } from "@/shared/api";
import type { ImportResult } from "../api/import.server";

// ============================================================================
// State
// ============================================================================

export type Step = "upload" | "validation" | "duplicates" | "importing" | "done";

export type ImportState = {
  step: Step;
  rows: CsvRow[];
  members: MemberInfo[];
  memberMapping: Map<string, string>;
  existingKartes: ExistingKarte[];
  formCategories: CategoryOption[];
  result: ImportResult | null;
  error: string | null;
  initialErrorIndices: Set<number>;
  notRecordedFieldsMap: Map<number, Set<keyof CsvRow>>;
  editingRowIndex: number | null;
  frozenEditableFields: Set<keyof CsvRow>;
  originalFormValues: Partial<KarteFormValues> | undefined;
  skippedIndices: Set<number>;
  comparingIndex: number | null;
  expandedDuplicates: Set<number>;
};

export const INITIAL_STATE: ImportState = {
  step: "upload",
  rows: [],
  members: [],
  memberMapping: new Map(),
  existingKartes: [],
  formCategories: [],
  result: null,
  error: null,
  initialErrorIndices: new Set(),
  notRecordedFieldsMap: new Map(),
  editingRowIndex: null,
  frozenEditableFields: new Set(),
  originalFormValues: undefined,
  skippedIndices: new Set(),
  comparingIndex: null,
  expandedDuplicates: new Set(),
};

// ============================================================================
// Actions
// ============================================================================

export type ImportAction =
  | {
      type: "FILE_LOADED";
      rows: CsvRow[];
      members: MemberInfo[];
      kartes: ExistingKarte[];
      categories: CategoryOption[];
      initialErrors: Set<number>;
    }
  | { type: "FILE_ERROR"; error: string }
  | {
      type: "OPEN_EDITOR";
      index: number;
      errorFields: Set<keyof CsvRow>;
      formValues: Partial<KarteFormValues>;
    }
  | { type: "CLOSE_EDITOR" }
  | { type: "MARK_NOT_RECORDED"; rowIndex: number; field: keyof CsvRow }
  | { type: "UPDATE_ROW"; index: number; row: CsvRow }
  | { type: "RESOLVE_ASSIGNEE"; name: string; memberId: string }
  | { type: "TOGGLE_SKIP"; index: number }
  | { type: "EXPAND_DUPLICATES"; index: number }
  | { type: "START_IMPORT" }
  | { type: "IMPORT_DONE"; result: ImportResult }
  | { type: "PROCEED_TO_DUPLICATES"; skipIndices: Set<number> }
  | { type: "BACK_TO_VALIDATION" }
  | { type: "SET_COMPARING"; index: number | null };

// ============================================================================
// Reducer
// ============================================================================

export function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case "FILE_LOADED":
      return {
        ...state,
        step: "validation",
        rows: action.rows,
        members: action.members,
        existingKartes: action.kartes,
        formCategories: action.categories,
        memberMapping: new Map(),
        initialErrorIndices: action.initialErrors,
        error: null,
      };

    case "FILE_ERROR":
      return { ...state, error: action.error };

    case "OPEN_EDITOR":
      return {
        ...state,
        editingRowIndex: action.index,
        frozenEditableFields: action.errorFields,
        originalFormValues: action.formValues,
      };

    case "CLOSE_EDITOR":
      return {
        ...state,
        editingRowIndex: null,
        frozenEditableFields: new Set(),
        originalFormValues: undefined,
      };

    case "MARK_NOT_RECORDED": {
      const nextMap = new Map(state.notRecordedFieldsMap);
      const fields = new Set(nextMap.get(action.rowIndex) ?? []);
      fields.add(action.field);
      nextMap.set(action.rowIndex, fields);
      return {
        ...state,
        notRecordedFieldsMap: nextMap,
        rows: state.rows.map((row, i) =>
          i === action.rowIndex ? { ...row, [action.field]: "" } : row,
        ),
      };
    }

    case "UPDATE_ROW":
      return {
        ...state,
        rows: state.rows.map((row, i) => (i === action.index ? action.row : row)),
      };

    case "RESOLVE_ASSIGNEE": {
      const nextMapping = new Map(state.memberMapping);
      nextMapping.set(action.name, action.memberId);
      return { ...state, memberMapping: nextMapping };
    }

    case "TOGGLE_SKIP": {
      const next = new Set(state.skippedIndices);
      if (next.has(action.index)) next.delete(action.index);
      else next.add(action.index);
      return { ...state, skippedIndices: next };
    }

    case "EXPAND_DUPLICATES":
      return {
        ...state,
        expandedDuplicates: new Set(state.expandedDuplicates).add(action.index),
      };

    case "START_IMPORT":
      return { ...state, step: "importing" };

    case "IMPORT_DONE":
      return { ...state, step: "done", result: action.result };

    case "PROCEED_TO_DUPLICATES":
      return { ...state, step: "duplicates", skippedIndices: action.skipIndices };

    case "BACK_TO_VALIDATION":
      return { ...state, step: "validation" };

    case "SET_COMPARING":
      return { ...state, comparingIndex: action.index };
  }
}
