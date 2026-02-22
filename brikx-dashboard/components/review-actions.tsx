"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ReviewActionsProps {
  id: string;
  currentStatus?: string | null;
}

export function ReviewActions({ id, currentStatus }: ReviewActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateStatus = (nextStatus: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/nieuws", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, review_status: nextStatus }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? "Kon status niet bijwerken");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Onbekende fout");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateStatus("approved")}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || currentStatus === "approved"}
        >
          Markeer als approved
        </button>
        <button
          type="button"
          onClick={() => updateStatus("rejected")}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || currentStatus === "rejected"}
        >
          Afwijzen
        </button>
        <button
          type="button"
          onClick={() => updateStatus("published")}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || currentStatus === "published"}
        >
          Markeer als gepubliceerd
        </button>
      </div>
      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}
      {isPending ? (
        <p className="text-sm text-slate-500">Status wordt bijgewerkt…</p>
      ) : null}
    </div>
  );
}
