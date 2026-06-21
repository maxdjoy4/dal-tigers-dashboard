import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import { hasSupabaseEnv } from "@/lib/env";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <>
      <PageHero
        eyebrow="Admin Login"
        title="Secure the upload flow with Supabase Auth."
        description="Admins sign in here before accessing upload tools and KPI settings."
      />
      <Panel
        eyebrow="Authentication"
        title="Staff admin access"
        description={
          hasSupabaseEnv()
            ? "Sign in with your Supabase email and password."
            : "Supabase is not configured yet. Add the environment variables from .env.example to enable login."
        }
      >
        <LoginForm isEnabled={hasSupabaseEnv()} />
      </Panel>
    </>
  );
}
