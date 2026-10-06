"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Icon } from "@/app/app/user-management/ui";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const errorParam = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        <span className="relative mt-1.5 block">
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            suppressHydrationWarning
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] py-3 pl-3.5 pr-12 text-[15px] outline-none transition focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/25"
          />
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-1.5 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--bg-accent)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
          >
            <Icon name={showPassword ? "eyeOff" : "eye"} className="h-5 w-5" />
          </button>
        </span>
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
    <main className="login-page relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--sidebar)] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-white">
        <div className="absolute inset-x-0 bottom-0 h-full portrait:h-[45%]">
          <Image
            src="/login-background.png"
            alt=""
            fill
            priority
            sizes="(orientation: portrait) 125vh, (max-aspect-ratio: 2089/753) 278vh, 100vw"
            className="login-photo object-cover object-bottom"
          />
        </div>
      </div>

      <div className="login-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-[var(--card)] shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
        <div className="border-b border-[var(--line)] bg-[var(--card)] px-7 py-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-[var(--brand-deep)] sm:text-3xl"
          >
            <BrandLogo size={44} className="rounded-lg" />
            Central7 Pulse
          </Link>
        </div>
        <div className="px-7 py-7 sm:px-8 sm:py-8">
          <h1 className="font-display text-3xl font-semibold text-[var(--ink)]">
            Sign In
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
