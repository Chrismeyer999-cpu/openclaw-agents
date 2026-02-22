import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getServiceClient } from "@/lib/supabase-server";
import { NewsTable } from "@/components/news-table";
import { ReviewActions } from "@/components/review-actions";

interface NieuwsDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: NieuwsDetailPageProps): Promise<Metadata> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("nieuws_items")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) {
    return { title: "Nieuwsitem niet gevonden" };
  }

  return {
    title: data.title,
    description: data.body?.substring(0, 160),
  };
}

export default async function NieuwsDetailPage({ params }: NieuwsDetailPageProps) {
  const supabase = getServiceClient();
  const { data: nieuwsItem } = await supabase
    .from("nieuws_items")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!nieuwsItem) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 pb-16 pt-10">
      <h1 className="mb-8 text-4xl font-bold">{nieuwsItem.title}</h1>
      <p className="mb-6 whitespace-pre-line text-lg">{nieuwsItem.body}</p>
      <ReviewActions id={params.id} currentStatus={nieuwsItem.review_status} />
    </main>
  );
}
