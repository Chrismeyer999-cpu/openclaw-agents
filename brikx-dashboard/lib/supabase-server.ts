import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/supabase/types";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Supabase configuratie ontbreekt. Voeg SUPABASE_URL en SUPABASE_SERVICE_KEY toe aan de omgeving.",
  );
}

export const getServiceClient = () =>
  createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        "x-application-name": "brikx-dashboard",
      },
    },
  });
