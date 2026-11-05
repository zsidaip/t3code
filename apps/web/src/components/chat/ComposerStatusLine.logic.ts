import type { OrchestrationV2ProviderTurnTokenUsage, UsageLimitsReport } from "@t3tools/contracts";
import { formatDuration, limitsNotice, remainingPercent } from "@t3tools/shared/usageLimits";

export interface ComposerStatusWindow {
  readonly label: string;
  readonly remainingPercent: number;
  readonly resetsIn: string | null;
}

export interface ComposerStatus {
  readonly windows: readonly ComposerStatusWindow[];
  readonly cache: { readonly remaining: string | null } | null;
}

type CacheUsage = Pick<
  OrchestrationV2ProviderTurnTokenUsage,
  "promptCacheTtlMs" | "promptCacheExpiresAt" | "updatedAt"
>;

const KIND_LABELS = { session: "Session", weekly: "Weekly" } as const;

function resetsIn(resetsAt: string | undefined, now: number): string | null {
  if (resetsAt === undefined) return null;
  const at = Date.parse(resetsAt);
  return Number.isFinite(at) && at > now ? formatDuration(at - now) : null;
}

function promptCacheRemaining(usage: CacheUsage, now: number): string | null {
  const expiresAt = usage.promptCacheExpiresAt
    ? Date.parse(usage.promptCacheExpiresAt)
    : Date.parse(usage.updatedAt) + (usage.promptCacheTtlMs ?? 0);
  if (!Number.isFinite(expiresAt)) return null;
  const left = expiresAt - now;
  if (left <= 0) return null;
  return left < 60_000 ? "<1m" : formatDuration(left);
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
            label: KIND_LABELS[kind],
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
