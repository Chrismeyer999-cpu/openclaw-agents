import { cache } from "react";
import { getServiceClient } from "@/lib/supabase-server";
import type { NewsItem, ReviewStatus } from "@/supabase/types";

interface ListOptions {
  status?: string | null;
  search?: string | null;
  minRelevance?: number;
}

export const listNewsItems = cache(async (options: ListOptions = {}) => {
  const { status, search, minRelevance = 0.7 } = options;
  const supabase = getServiceClient();
  let query = supabase
    .from("news_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (typeof minRelevance === "number") {
    query = query.gte("relevance", minRelevance);
  }

  if (status && status !== "all") {
    query = query.eq("review_status", status);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,summary.ilike.%${search}%,source_name.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Kon nieuwsitems niet laden: ${error.message}`);
  }
  return data ?? [];
});

export const getNewsItem = cache(async (id: string) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("news_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    throw new Error(`Kon nieuwsitem niet ophalen: ${error.message}`);
  }
  return data as NewsItem | null;
});

export async function updateNewsStatus(id: string, status: ReviewStatus) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("news_items")
    .update({ review_status: status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw new Error(`Kon status niet bijwerken: ${error.message}`);
  }
  return data;
}
