"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { KarteTable, type KarteTableRow } from "@/widgets/karte-table";
import { KarteForm, type KarteFormValues } from "@/widgets/karte-form";
import type { MemberOption, CategoryOption } from "@/shared/api";

type Props = {
  kartes: KarteTableRow[];
  members: MemberOption[];
  categories: CategoryOption[];
};

/** KarteTableRow → KarteFormValues（読み取り専用表示用） */
function toFormValues(row: KarteTableRow, members: MemberOption[]): Partial<KarteFormValues> {
  const client = row.client.type === "recorded" ? row.client.value : null;
  const resolution = row.supportRecord.resolution;
  const resType = resolution.type === "recorded" ? resolution.value.type : "resolved";
  const followUp =
    resolution.type === "recorded" && resolution.value.type === "unresolved"
      ? (resolution.value.followUp ?? "")
      : "";

  const affData = client?.affiliationData;

  return {
    consultedAtPrecision:
      row.consultedAt.type === "recorded"
        ? (row.consultedAt.value.precision as KarteFormValues["consultedAtPrecision"])
        : "datetime",
    consultedAt: row.consultedAt.type === "recorded" ? row.consultedAt.value.value : "",
    clientType: (client?.type === "学生"
      ? "student"
      : client?.type === "教員"
        ? "teacher"
        : client?.type === "職員"
          ? "staff"
          : "other") as KarteFormValues["clientType"],
    clientName: client?.name ?? "",
    studentId: client?.studentId ?? "",
    courseType: affData?.courseType ?? "undergraduate",
    faculty: affData?.faculty ?? "",
    department: affData?.department ?? "",
    year: affData ? String(affData.year) : "",
    liabilityConsent: row.consent.liabilityConsent,
    disclosureConsent: row.consent.disclosureConsent,
    categoryIds: new Set(
      row.consultation.categories.type === "recorded"
        ? row.consultation.categories.value.map((c) => c.id)
        : [],
    ),
    targetDevice:
      row.consultation.targetDevice.type === "recorded" ? row.consultation.targetDevice.value : "",
    troubleDetails:
      row.consultation.troubleDetails.type === "recorded"
        ? row.consultation.troubleDetails.value
        : "",
    assignedMemberIds: new Set(
      row.assignedMemberNames
        .map((name) => members.find((m) => m.name === name)?.id)
        .filter((id): id is string => id !== undefined),
    ),
    supportContent:
      row.supportRecord.content.type === "recorded" ? row.supportRecord.content.value : "",
    resolutionType: resType as "resolved" | "unresolved",
    followUp,
    workDurationMinutes:
      row.supportRecord.workDuration.type === "recorded"
        ? String(row.supportRecord.workDuration.value)
        : "",
  };
}

export function KarteListWithDetail({ kartes, members, categories }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedRow = selectedIndex !== null ? kartes[selectedIndex] : null;

  return (
    <>
      <KarteTable
        kartes={kartes}
        members={members}
        onRowClick={(_, index) => setSelectedIndex(index)}
      />

      <Sheet open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <SheetContent className="overflow-y-auto p-8">
          <SheetHeader>
            <SheetTitle>
              カルテ詳細
              {selectedRow && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {new Date(selectedRow.recordedAt).toLocaleString("ja-JP")}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedRow && (
            <div className="mt-4">
              <KarteForm
                members={members}
                categories={categories}
                initialValues={toFormValues(selectedRow, members)}
                readOnly
                unresolvedAssigneeNames={selectedRow.assignedMemberNames.filter(
                  (name) => !members.some((m) => m.name === name),
                )}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
