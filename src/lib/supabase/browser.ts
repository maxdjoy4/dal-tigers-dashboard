"use client";

import { createBrowserClient } from "@supabase/ssr";

import { hasSupabaseEnv, requireSupabaseEnv } from "@/lib/env";
import type { SupabaseDatabase } from "@/lib/supabase/types";

let browserClient: ReturnType<
  typeof createBrowserClient<SupabaseDatabase>
> | null = null;

export function createSupabaseBrowserClient() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  if (!browserClient) {
    const env = requireSupabaseEnv();
    browserClient = createBrowserClient<SupabaseDatabase>(
      env.url,
      env.anonKey,
    );
  }

  return browserClient;
}
