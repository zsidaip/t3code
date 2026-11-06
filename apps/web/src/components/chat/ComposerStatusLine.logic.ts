import type { OrchestrationV2ProviderTurnTokenUsage, UsageLimitsReport } from "@t3tools/contracts";
import { formatDuration, limitsNotice, usedPercent } from "@t3tools/shared/usageLimits";

export interface ComposerDuration {
  readonly short: string;
  readonly long: string;
}

export interface ComposerStatusWindow {
  readonly label: string;
  readonly usedPercent: number;
  readonly resetsIn: ComposerDuration | null;
}

export interface ComposerStatus {
  readonly windows: readonly ComposerStatusWindow[];
  readonly cache: {
    readonly remaining: ComposerDuration | null;
    readonly fraction: number;
  } | null;
}

export type ComposerBarTone = "normal" | "good" | "warning" | "critical";

const CACHE_LOW_FRACTION = 0.2;
const CACHE_GOOD_FRACTION = 0.9;

export function cacheFraction(leftMs: number, ttlMs: number): number {
  return ttlMs > 0 && Number.isFinite(leftMs) ? Math.min(1, Math.max(0, leftMs / ttlMs)) : 0;
}

export function cacheTone(fraction: number, expired: boolean): ComposerBarTone {
  if (expired) return "critical";
  if (fraction < CACHE_LOW_FRACTION) return "warning";
  return fraction >= CACHE_GOOD_FRACTION ? "good" : "normal";
}

type CacheUsage = Pick<
  OrchestrationV2ProviderTurnTokenUsage,
  "promptCacheTtlMs" | "promptCacheExpiresAt" | "updatedAt"
>;

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function compactDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE_MS);
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`;
  if (hours > 0) return rest > 0 ? `${hours}h${rest}m` : `${hours}h`;
  return `${rest}m`;
}

function duration(ms: number): ComposerDuration {
  return { short: compactDuration(ms), long: formatDuration(ms) };
}

function resetsIn(resetsAt: string | undefined, now: number): ComposerDuration | null {
  if (resetsAt === undefined) return null;
  const at = Date.parse(resetsAt);
  return Number.isFinite(at) && at > now ? duration(at - now) : null;
}

function promptCacheStatus(
  usage: CacheUsage,
  now: number,
): { remaining: ComposerDuration | null; fraction: number } {
  const expiresAt = usage.promptCacheExpiresAt
    ? Date.parse(usage.promptCacheExpiresAt)
    : Date.parse(usage.updatedAt) + (usage.promptCacheTtlMs ?? 0);
  const left = expiresAt - now;
  if (!Number.isFinite(left) || left <= 0) return { remaining: null, fraction: 0 };
  return {
    remaining: left < MINUTE_MS ? { short: "<1m", long: "<1m" } : duration(left),
    fraction: cacheFraction(left, usage.promptCacheTtlMs ?? 0),
  };
}

export function deriveComposerStatusLine(input: {
  readonly report: UsageLimitsReport | null;
  readonly instanceId: string | null;
  readonly liveUsage: CacheUsage | null;
  readonly promptCacheSupported: boolean;
  readonly now: number;
}): ComposerStatus | null {
  const usable = (input.report?.accounts ?? []).filter(
    (candidate) => limitsNotice(candidate.limits) === null,
  );
  const account =
    usable.find((candidate) => candidate.instanceId === input.instanceId) ?? usable[0];
  const windows = (["session", "weekly"] as const).flatMap((kind) => {
    const window = account?.limits.windows.find((candidate) => candidate.kind === kind);
    return window
      ? [
          {
            label: window.label,
            usedPercent: usedPercent(window),
            resetsIn: resetsIn(window.resetsAt, input.now),
          },
        ]
      : [];
  });
  const cache =
    input.liveUsage?.promptCacheTtlMs !== undefined
      ? promptCacheStatus(input.liveUsage, input.now)
      : input.promptCacheSupported
        ? { remaining: null, fraction: 0 }
        : null;
  if (windows.length === 0 && cache === null) return null;
  return { windows, cache };
}
