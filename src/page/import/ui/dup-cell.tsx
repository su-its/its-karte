import { TableCell } from "@/shared/ui/table";
import { cn } from "@/shared/lib";

export function DupCell({
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
