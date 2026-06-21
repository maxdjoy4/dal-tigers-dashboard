import { redirect } from "next/navigation";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function isCurrentUserAdmin() {
  if (!hasSupabaseEnv()) {
    return true;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return false;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const metadataAdmin = Boolean(user.user_metadata?.is_admin);
  if (metadataAdmin) {
    return true;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return Boolean(profile?.is_admin);
}

export async function requireAdminUser() {
  const isAdmin = await isCurrentUserAdmin();

  if (!isAdmin) {
    redirect("/login");
  }

  return true;
}
