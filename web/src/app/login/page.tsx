"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const errorParam = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(errorParam);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace("/auth/continue");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" suppressHydrationWarning>
      <label className="block text-sm font-medium" suppressHydrationWarning>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          suppressHydrationWarning
          className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--brand)] focus:ring-2"
          placeholder="keerthie@central7.lk"
        />
      </label>
      <label className="block text-sm font-medium" suppressHydrationWarning>
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          suppressHydrationWarning
          className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--brand)] focus:ring-2"
        />
      </label>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        suppressHydrationWarning
        className="w-full rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--card)] p-8 shadow-[0_20px_60px_rgba(20,34,27,0.08)]">
        <Link href="/" className="font-display text-2xl font-semibold text-[var(--brand-deep)]">
          Central7 Pulse
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold">Sign in</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
