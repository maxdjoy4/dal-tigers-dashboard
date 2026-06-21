import { createClient } from "@supabase/supabase-js";

import { requireServiceRole } from "@/lib/env";
import type { SupabaseDatabase } from "@/lib/supabase/types";

let serviceClient: ReturnType<typeof createClient<SupabaseDatabase>> | null =
  null;

export function createServiceSupabaseClient() {
  if (!serviceClient) {
    const env = requireServiceRole();
    serviceClient = createClient<SupabaseDatabase>(env.url, env.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serviceClient;
}
