"use client";

import { useRouter } from "next/navigation";
import { KarteForm, type KarteFormValues, type MemberOption } from "@/components/karte-form";
import type { KarteFormInput } from "@/actions/karte";

type Props = {
  members: MemberOption[];
  categories: { id: string; displayName: string }[];
  createKarte: (input: KarteFormInput) => Promise<{ id: string }>;
};

export function NewKarteClient({ members, categories, createKarte }: Props) {
  const router = useRouter();

  async function handleSubmit(values: KarteFormValues) {
    const input: KarteFormInput = {
      consultedAtPrecision: values.consultedAtPrecision,
      consultedAt: values.consultedAt,
      clientType: values.clientType,
      clientName: values.clientName,
      studentId: values.studentId,
      courseType: values.courseType,
      faculty: values.faculty,
      department: values.department,
      year: Number(values.year) || 1,
      liabilityConsent: values.liabilityConsent,
      disclosureConsent: values.disclosureConsent,
      categoryIds: [...values.categoryIds],
      targetDevice: values.targetDevice,
      troubleDetails: values.troubleDetails,
      assignedMemberIds: [...values.assignedMemberIds],
      supportContent: values.supportContent,
      resolutionType: values.resolutionType,
      followUp: values.followUp,
      workDurationMinutes: Number(values.workDurationMinutes) || 0,
    };

    await createKarte(input);
    router.push("/");
  }

  return (
    <KarteForm
      members={members}
      categories={categories}
      onSubmit={handleSubmit}
      submitLabel="カルテを作成"
    />
  );
}
