import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { NewsItem } from "@/supabase/types";

interface NewsTableProps {
  items: NewsItem[];
}

function siteLabel(item: NewsItem): string {
  const agentTag = item.tags?.[0];
  if (agentTag === "zwijsen-agent") return "zwijsen.net";
  if (agentTag === "brikx-agent") return "brikxai.nl";
  if (agentTag === "kavel-agent") return "kavelarchitect.nl";

  const topic = item.topic?.toLowerCase() ?? "";
  if (topic.includes("zwijsen-agent")) return "zwijsen.net";
  if (topic.includes("brikx-agent")) return "brikxai.nl";
  if (topic.includes("kavel-agent")) return "kavelarchitect.nl";
  return "onbekend";
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
            <th className="px-4 py-3">Bestemd voor</th>
            <th className="px-4 py-3">Bron</th>
            <th className="px-4 py-3">Fit-score</th>
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
                  {item.summary ? (
                    <p className="line-clamp-2 max-w-2xl text-xs text-slate-600">{item.summary}</p>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                  {siteLabel(item)}
                </span>
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
              <td className="px-4 py-3 text-xs text-slate-700">
                <div className="font-mono">{(item.relevance ?? 0).toFixed(2)}</div>
                <div className="text-[11px] text-slate-500">{Math.round((item.relevance ?? 0) * 100)}%</div>
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
