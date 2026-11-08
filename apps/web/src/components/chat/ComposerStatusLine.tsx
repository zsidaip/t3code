import type {
  OrchestrationV2ProviderTurnTokenUsage,
  ProviderInstanceId,
  ServerProvider,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { collectProviderUsageLimits } from "@t3tools/shared/usageLimits";

import { useNowMinute } from "../../hooks/useNowMinute";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  cacheTone,
  type ComposerBarTone,
  type ComposerStatus,
  deriveComposerStatusLine,
} from "./ComposerStatusLine.logic";

export function useComposerStatusLine({
  providerInstanceId,
  providerDriver,
  providers,
  sources,
  liveUsage,
}: {
  readonly providerInstanceId: ProviderInstanceId | null;
  readonly providerDriver: ServerProvider["driver"] | null;
  readonly providers: readonly ServerProvider[];
  readonly sources: UsageLimitSourceSnapshots;
  readonly liveUsage: OrchestrationV2ProviderTurnTokenUsage | null;
}): ComposerStatus | null {
  const now = Date.parse(`${useNowMinute()}Z`);
  const report =
    providerInstanceId === null
      ? null
      : collectProviderUsageLimits(providerInstanceId, providers, sources, now);
  return deriveComposerStatusLine({
    report,
    instanceId: providerInstanceId,
    liveUsage,
    promptCacheSupported: providerDriver === "claudeAgent",
    now,
  });
}

const TONE_FILL: Record<ComposerBarTone, string> = {
  normal: "bg-foreground",
  good: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
};

export function ComposerCacheBar({
  cache,
}: {
  readonly cache: NonNullable<ComposerStatus["cache"]>;
}) {
  const expired = cache.remaining === null;
  const label = cache.remaining
    ? `Prompt cache: ${cache.remaining.long} left`
    : "Prompt cache expired";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="img"
            tabIndex={0}
            aria-label={label}
            data-chat-composer-cache-bar="true"
            className="flex h-1.5 w-full shrink-0 items-end outline-none"
          />
        }
      >
        <span
          className={cn(
            "block h-[3px] w-full overflow-hidden rounded-full",
            expired ? "bg-destructive/40" : "bg-foreground/15",
          )}
        >
          <span
            className={cn("block h-full", TONE_FILL[cacheTone(cache.fraction, expired)])}
            style={{ width: `${Math.round(cache.fraction * 100)}%` }}
          />
        </span>
      </TooltipTrigger>
      <TooltipPopup side="top">{label}</TooltipPopup>
    </Tooltip>
  );
}
