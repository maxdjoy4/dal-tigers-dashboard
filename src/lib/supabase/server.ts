import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { hasSupabaseEnv, requireSupabaseEnv } from "@/lib/env";
import type { SupabaseDatabase } from "@/lib/supabase/types";

export async function createSupabaseServerClient() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const cookieStore = await cookies();
  const env = requireSupabaseEnv();

  return createServerClient<SupabaseDatabase>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookieList) {
        try {
          cookieList.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components may call this during render, where writes are ignored.
        }
      },
    },
  });
}
