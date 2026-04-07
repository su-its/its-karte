import { Button } from "@/shared/ui/button";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";

export function ErrorNavFooter({
  hasError,
  remainingErrors,
  onPrev,
  onNext,
  onClose,
}: {
  hasError: boolean;
  remainingErrors: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-between">
      <Button variant="ghost" size="sm" onClick={onPrev}>
        <ArrowLeftIcon data-icon="inline-start" /> 前のエラー
      </Button>
      {hasError ? (
        <Button variant="outline" size="sm" disabled>
          エラーを修正してください
        </Button>
      ) : remainingErrors > 0 ? (
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={onNext}>
          <CheckCircle2Icon data-icon="inline-start" />
          次のエラーへ（残り{remainingErrors}件）
        </Button>
      ) : (
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={onClose}>
          <CheckCircle2Icon data-icon="inline-start" />
          すべて解決しました
        </Button>
      )}
    </div>
  );
}
