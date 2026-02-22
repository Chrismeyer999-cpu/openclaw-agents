import clsx from "clsx";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  published: "bg-slate-200 text-slate-900 border-slate-300",
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase?.() ?? "pending";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[normalized] ?? STATUS_STYLES.pending,
      )}
    >
      {normalized}
    </span>
  );
}
