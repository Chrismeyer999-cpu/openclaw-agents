import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const relevance = parseFloat(url.searchParams.get("relevance") ?? "0");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("nieuws_items")
    .select("*")
    .gt("relevance", relevance)
    .order("published", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Onbekende fout bij ophalen nieuws" },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, review_status } = await request.json();

    if (!id || !review_status) {
      return NextResponse.json(
        { error: "id en review_status zijn verplicht" },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("nieuws_items")
      .update({ review_status })
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Onbekende fout bij updaten nieuws" },
        { status: 500 },
      );
    }

    return NextResponse.json(data ? data[0] : null);
  } catch (e) {
    return NextResponse.json({ error: "Fout bij parsen body" }, { status: 400 });
  }
}
