const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY;

export function hasSupabaseEnv() {
  return Boolean(publicUrl && publicAnonKey);
}

export function hasSupabaseServiceRole() {
  return Boolean(publicUrl && serviceRoleKey);
}

export function isDemoMode() {
  return !hasSupabaseEnv();
}

export function hasOpenAIApiKey() {
  return Boolean(openAiApiKey);
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export function requireSupabaseEnv() {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return {
    url: publicUrl as string,
    anonKey: publicAnonKey as string,
  };
}

export function requireServiceRole() {
  if (!hasSupabaseServiceRole()) {
    throw new Error("Supabase service role is not configured.");
  }

  return {
    url: publicUrl as string,
    serviceRoleKey: serviceRoleKey as string,
  };
}

export function requireOpenAIApiKey() {
  if (!hasOpenAIApiKey()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return openAiApiKey as string;
}
