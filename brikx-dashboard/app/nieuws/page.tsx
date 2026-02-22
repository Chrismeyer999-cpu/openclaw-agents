import { StatusBadge } from "@/components/status-badge";
import { NewsTable } from "@/components/news-table";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "edge";

export const dynamic = "force-dynamic";

export default async function NieuwsPage() {
  const supabase = getServiceClient();
  const { data: nieuwsItems, error } = await supabase
    .from("nieuws_items")
    .select("*")
    .gt("relevance", 0.7)
    .order("published", { ascending: false })
    .limit(100);

  if (error) {
    return <div>Fout bij ophalen van nieuws: {error.message}</div>;
  }

  return (
    <main className="container mx-auto px-4 pb-16 pt-10">
      <h1 className="mb-10 text-4xl font-bold">Nieuws</h1>
      <NewsTable items={nieuwsItems ?? []} />
    </main>
  );
}
