import type {
  OrchestrationV2ProviderTurnTokenUsage,
  ProviderInstanceId,
  ServerProvider,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { collectProviderUsageLimits } from "@t3tools/shared/usageLimits";
import { GaugeIcon, TimerIcon } from "lucide-react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { type ComposerStatus, deriveComposerStatusLine } from "./ComposerStatusLine.logic";

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

export function ComposerStatusLine({ line }: { readonly line: ComposerStatus }) {
  const cacheExpired = line.cache !== null && line.cache.remaining === null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className="flex min-w-0 shrink-4 items-center gap-2 text-xs text-muted-foreground tabular-nums"
            data-chat-composer-status-line="true"
          />
        }
      >
        <GaugeIcon className="size-3.5 shrink-0" />
        {line.windows.map((window, index) => (
          <span key={window.label} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
            ) : null}
            <span className="truncate">
              <span className="font-medium text-foreground">{window.usedPercent}%</span>
              {window.resetsIn ? <span> {window.resetsIn.short}</span> : null}
            </span>
          </span>
        ))}
        {line.cache ? (
          <span
            className={cn("flex shrink-0 items-center gap-1", cacheExpired && "text-destructive")}
          >
            <TimerIcon aria-hidden="true" className="size-3.5" />
            <span className={cn(!cacheExpired && "font-medium text-foreground")}>
              {line.cache.remaining?.short ?? "–"}
            </span>
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="top">
        {line.windows.map((window) => (
          <span key={window.label} className="block">
            {`${window.label}: ${window.usedPercent}% used`}
            {window.resetsIn ? ` · resets in ${window.resetsIn.long}` : null}
          </span>
        ))}
        {line.cache ? (
          <span className="block">
            {line.cache.remaining
              ? `Prompt cache: ${line.cache.remaining.long} left`
              : "Prompt cache expired"}
          </span>
        ) : null}
      </TooltipPopup>
    </Tooltip>
  );
}
