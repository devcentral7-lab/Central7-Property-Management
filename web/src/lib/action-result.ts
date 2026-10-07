import { unstable_rethrow } from "next/navigation";

/**
 * Next.js hides thrown server-action messages in production, so actions that
 * users call return their errors instead.
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message) {
    return e.message;
  }
  return fallback;
}

/** Runs `fn`, returning its error as a result. Redirects and notFound() still propagate. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: errorMessage(e) };
  }
}
