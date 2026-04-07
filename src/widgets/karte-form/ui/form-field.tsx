import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Field, FieldLabel } from "@/shared/ui/field";
import type { KarteFormValues } from "../model/karte-form-values";

// ============================================================================
// OriginalValueHint — shows the value before editing
// ============================================================================

export function OriginalValueHint({
  field,
  editableFields,
  originalValue,
}: {
  field: keyof KarteFormValues;
  editableFields?: Set<keyof KarteFormValues>;
  originalValue?: string;
}) {
  if (!editableFields?.has(field) || originalValue === undefined) return null;
  return (
    <div className="text-xs text-muted-foreground mb-1">
      修正前: <span className="font-mono">{originalValue || "（空）"}</span>
    </div>
  );
}

// ============================================================================
// NotRecordedPill — button to mark a field as "not recorded"
// ============================================================================

export function NotRecordedPill({
  field,
  editableFields,
  onMarkNotRecorded,
  onClear,
}: {
  field: keyof KarteFormValues;
  editableFields?: Set<keyof KarteFormValues>;
  onMarkNotRecorded?: (field: keyof KarteFormValues) => void;
  onClear: () => void;
}) {
  if (!onMarkNotRecorded || !editableFields?.has(field)) return null;
  return (
    <button
      type="button"
      className="rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      onClick={() => {
        onClear();
        onMarkNotRecorded(field);
      }}
    >
      未記録にする
    </button>
  );
}

// ============================================================================
// FieldHeader — label + optional not-recorded pill
// ============================================================================

export function FieldHeader({
  field,
  label,
  editableFields,
  onMarkNotRecorded,
  onClear,
}: {
  field: keyof KarteFormValues;
  label: string;
  editableFields?: Set<keyof KarteFormValues>;
  onMarkNotRecorded?: (field: keyof KarteFormValues) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center gap-2" data-field={field}>
      <FieldLabel
        className={editableFields?.has(field) ? "text-destructive font-semibold" : undefined}
      >
        {label}
      </FieldLabel>
      {onClear && (
        <NotRecordedPill
          field={field}
          editableFields={editableFields}
          onMarkNotRecorded={onMarkNotRecorded}
          onClear={onClear}
        />
      )}
    </div>
  );
}

// ============================================================================
// FormField — editable or read-only input field
// ============================================================================

export function FormField({
  field,
  label,
  value,
  isEditable,
  originalValue,
  editableFields,
  onChange,
  onMarkNotRecorded,
  type,
  placeholder,
  required,
  min,
  max,
}: {
  field: keyof KarteFormValues;
  label: string;
  value: string;
  isEditable: boolean;
  originalValue?: string;
  editableFields?: Set<keyof KarteFormValues>;
  onChange: (value: string) => void;
  onMarkNotRecorded?: (field: keyof KarteFormValues) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  const isModified = isEditable && originalValue !== undefined && originalValue !== value;
  return (
    <Field>
      <FieldHeader
        field={field}
        label={label}
        editableFields={editableFields}
        onMarkNotRecorded={onMarkNotRecorded}
        onClear={() => onChange("")}
      />
      <OriginalValueHint
        field={field}
        editableFields={editableFields}
        originalValue={originalValue}
      />
      {isEditable ? (
        <Input
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={
            isModified
              ? "border-green-500"
              : editableFields?.has(field)
                ? "border-destructive"
                : undefined
          }
        />
      ) : (
        <div className="text-sm py-2.5 px-1 min-h-[2.25rem]">
          {value || <span className="text-muted-foreground">—</span>}
        </div>
      )}
    </Field>
  );
}

// ============================================================================
// FormTextarea — editable or read-only textarea field
// ============================================================================

export function FormTextarea({
  field,
  label,
  value,
  isEditable,
  originalValue,
  editableFields,
  onChange,
  onMarkNotRecorded,
  placeholder,
}: {
  field: keyof KarteFormValues;
  label: string;
  value: string;
  isEditable: boolean;
  originalValue?: string;
  editableFields?: Set<keyof KarteFormValues>;
  onChange: (value: string) => void;
  onMarkNotRecorded?: (field: keyof KarteFormValues) => void;
  placeholder?: string;
}) {
  const isModified = isEditable && originalValue !== undefined && originalValue !== value;
  return (
    <Field>
      <FieldHeader
        field={field}
        label={label}
        editableFields={editableFields}
        onMarkNotRecorded={onMarkNotRecorded}
        onClear={() => onChange("")}
      />
      <OriginalValueHint
        field={field}
        editableFields={editableFields}
        originalValue={originalValue}
      />
      {isEditable ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          required
          className={
            isModified
              ? "border-green-500"
              : editableFields?.has(field)
                ? "border-destructive"
                : undefined
          }
        />
      ) : (
        <div className="text-sm py-2.5 px-1 whitespace-pre-wrap">
          {value || <span className="text-muted-foreground">—</span>}
        </div>
      )}
    </Field>
  );
}
