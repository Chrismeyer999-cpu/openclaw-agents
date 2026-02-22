import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { NewsItem } from "@/supabase/types";

interface NewsTableProps {
  items: NewsItem[];
}

export function NewsTable({ items }: NewsTableProps) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Geen nieuwsitems gevonden voor deze filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Titel</th>
            <th className="px-4 py-3">Bron</th>
            <th className="px-4 py-3">Relevance</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Acties</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  {item.topic ? (
                    <p className="text-xs text-slate-500">{item.topic}</p>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                <a
                  href={item.source_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  {item.source_name || new URL(item.source_url ?? "https://example.com").hostname}
                </a>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700">
                {(item.relevance ?? 0).toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.review_status ?? "pending"} />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/nieuws/${item.id}`}
                  className="text-sm font-medium text-sky-600 hover:text-sky-500"
                >
                  Bekijken
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
