import type { OrchestrationV2ProviderTurnTokenUsage, UsageLimitsReport } from "@t3tools/contracts";
import { formatDuration, limitsNotice, remainingPercent } from "@t3tools/shared/usageLimits";

export interface ComposerDuration {
  readonly short: string;
  readonly long: string;
}

export interface ComposerStatusWindow {
  readonly label: string;
  readonly remainingPercent: number;
  readonly resetsIn: ComposerDuration | null;
}

export interface ComposerStatus {
  readonly windows: readonly ComposerStatusWindow[];
  readonly cache: { readonly remaining: ComposerDuration | null } | null;
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

function promptCacheRemaining(usage: CacheUsage, now: number): ComposerDuration | null {
  const expiresAt = usage.promptCacheExpiresAt
    ? Date.parse(usage.promptCacheExpiresAt)
    : Date.parse(usage.updatedAt) + (usage.promptCacheTtlMs ?? 0);
  if (!Number.isFinite(expiresAt)) return null;
  const left = expiresAt - now;
  if (left <= 0) return null;
  return left < MINUTE_MS ? { short: "<1m", long: "<1m" } : duration(left);
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
            remainingPercent: remainingPercent(window),
            resetsIn: resetsIn(window.resetsAt, input.now),
          },
        ]
      : [];
  });
  const cache =
    input.liveUsage?.promptCacheTtlMs !== undefined
      ? { remaining: promptCacheRemaining(input.liveUsage, input.now) }
      : input.promptCacheSupported
        ? { remaining: null }
        : null;
  if (windows.length === 0 && cache === null) return null;
  return { windows, cache };
}
