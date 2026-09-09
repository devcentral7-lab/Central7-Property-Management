import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function dataPath(...parts: string[]): string {
  return path.join(process.cwd(), 'data', ...parts);
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function s(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function parseNumber(v: unknown): number | null {
  const raw = s(v).replace(/,/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseBool(v: unknown): boolean {
  const raw = s(v).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'y';
}

export function parseRefSeq(refNo: string): number | null {
  const m = /^C7-(\d+)$/i.exec(s(refNo));
  return m ? Number(m[1]) : null;
}

export function splitAmenities(...parts: unknown[]): string[] {
  const set = new Set<string>();
  for (const part of parts) {
    for (const piece of s(part).split(/[,;|]/)) {
      const item = piece.trim();
      if (item) set.add(item);
    }
  }
  return [...set];
}

export function coerceTimestamp(v: unknown): string | null {
  const raw = s(v);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatContactNumber(raw: unknown): string {
  let n = s(raw).replace(/[^\d+]/g, '');
  if (!n) return '';
  // Mirror Code.gs formatContactNumber_ intent: keep digits; prefer local 0-prefix when clear
  if (n.startsWith('00')) n = n.slice(2);
  return n;
}
