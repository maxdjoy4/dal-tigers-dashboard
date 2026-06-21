"use client";

import { useState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface LoginFormProps {
  isEnabled: boolean;
}

export function LoginForm({ isEnabled }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{
    status: "idle" | "saving" | "error" | "success";
    message?: string;
  }>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isEnabled) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setState({
        status: "error",
        message: "Supabase environment variables are missing.",
      });
      return;
    }

    setState({ status: "saving" });
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setState({ status: "error", message: error.message });
      return;
    }

    setState({ status: "success", message: "Signed in. You can open the admin pages now." });
    window.location.href = "/admin/upload";
  }

  return (
    <form className="max-w-xl space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
        <input
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          disabled={!isEnabled}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
        <input
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          disabled={!isEnabled}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-full border border-gold-300/35 bg-gold-300/15 px-5 py-3 text-sm font-semibold text-gold-50 disabled:opacity-50"
        disabled={!isEnabled || state.status === "saving"}
        type="submit"
      >
        {state.status === "saving" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Sign in
      </button>
      {state.message ? (
        <p
          className={`text-sm ${
            state.status === "error" ? "text-rose-200" : "text-emerald-200"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
