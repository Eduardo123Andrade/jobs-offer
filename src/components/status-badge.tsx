import { STATUS_COLORS, STATUS_LABELS, type Status } from "@/lib/constants";

export function StatusDot({ status }: { status: Status }) {
  return <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[status] }} />;
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium">
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}
