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
    <form
      onSubmit={onSubmit}
      className="mt-8 space-y-5"
      suppressHydrationWarning
    >
      <label className="block text-sm font-medium text-[var(--ink)]" suppressHydrationWarning>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          suppressHydrationWarning
          className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-[15px] outline-none transition focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/25"
          placeholder="you@central7.lk"
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink)]" suppressHydrationWarning>
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          suppressHydrationWarning
          className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-[15px] outline-none transition focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/25"
        />
      </label>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/8 px-3.5 py-2.5 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        suppressHydrationWarning
        className="mt-1 w-full rounded-xl bg-[var(--brand)] py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[var(--bg)]"
      />
      <div
        aria-hidden
        className="login-wash pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="login-grid pointer-events-none absolute inset-0 opacity-[0.4]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black/20 backdrop-blur-[2px]"
      />

      <div className="login-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_24px_64px_rgba(28,25,23,0.18)]">
        <div className="border-b border-[var(--line)] bg-[var(--card)] px-7 py-5 sm:px-8">
          <Link
            href="/"
            className="font-display text-2xl font-semibold tracking-tight text-[var(--brand-deep)] sm:text-3xl"
          >
            Central7 Pulse
          </Link>
        </div>
        <div className="px-7 py-7 sm:px-8 sm:py-8">
          <h1 className="font-display text-3xl font-semibold text-[var(--ink)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Use your Central 7 staff email and password.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-8 text-center text-sm text-[var(--muted)]">
            Looking for public listings?{" "}
            <Link
              href="/search"
              className="font-semibold text-[var(--brand-deep)] underline-offset-2 hover:underline"
            >
              Browse search
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
