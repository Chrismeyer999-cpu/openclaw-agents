import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getNewsItem } from "@/lib/news";
import { ReviewActions } from "@/components/review-actions";

interface NieuwsDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: NieuwsDetailPageProps): Promise<Metadata> {
  const item = await getNewsItem(params.id);

  if (!item) {
    return { title: "Nieuwsitem niet gevonden" };
  }

  return {
    title: item.title,
    description: item.body?.substring(0, 160) ?? item.summary ?? undefined,
  };
}

function siteLabel(tags: string[] | null, topic: string | null): string {
  const agentTag = tags?.[0];
  if (agentTag === "zwijsen-agent") return "zwijsen.net";
  if (agentTag === "brikx-agent") return "brikxai.nl";
  if (agentTag === "kavel-agent") return "kavelarchitect.nl";

  const t = topic?.toLowerCase() ?? "";
  if (t.includes("zwijsen-agent")) return "zwijsen.net";
  if (t.includes("brikx-agent")) return "brikxai.nl";
  if (t.includes("kavel-agent")) return "kavelarchitect.nl";
  return "onbekend";
}

export default async function NieuwsDetailPage({ params }: NieuwsDetailPageProps) {
  const item = await getNewsItem(params.id);

  if (!item) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 pb-16 pt-10">
      <h1 className="mb-4 text-4xl font-bold">{item.title}</h1>
      <div className="mb-6 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded bg-slate-100 px-2 py-1">Bestemd voor: {siteLabel(item.tags, item.topic)}</span>
        <span className="rounded bg-slate-100 px-2 py-1">Fit-score: {Math.round((item.relevance ?? 0) * 100)}%</span>
        {item.source_name ? <span className="rounded bg-slate-100 px-2 py-1">Bron: {item.source_name}</span> : null}
      </div>
      <p className="mb-6 whitespace-pre-line text-lg">{item.body ?? item.summary}</p>
      <ReviewActions id={params.id} currentStatus={item.review_status ?? "pending"} />
    </main>
  );
}
