import type {
  OrchestrationV2ProviderTurnTokenUsage,
  ProviderInstanceId,
  ServerProvider,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { collectProviderUsageLimits } from "@t3tools/shared/usageLimits";
import { GaugeIcon } from "lucide-react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { cn } from "../../lib/utils";
import { deriveComposerStatusLine } from "./ComposerStatusLine.logic";

export function ComposerStatusLine({
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
}) {
  const now = Date.parse(`${useNowMinute()}Z`);
  const report =
    providerInstanceId === null
      ? null
      : collectProviderUsageLimits(providerInstanceId, providers, sources, now);
  const line = deriveComposerStatusLine({
    report,
    instanceId: providerInstanceId,
    liveUsage,
    promptCacheSupported: providerDriver === "claudeAgent",
    now,
  });
  if (line === null) return null;
  const cacheExpired = line.cache !== null && line.cache.remaining === null;
  return (
    <div
      className="flex h-8 min-w-0 shrink items-center gap-1.5 text-xs font-medium text-foreground/80 tabular-nums"
      data-chat-composer-status-line="true"
    >
      <GaugeIcon className="size-3.5 shrink-0 text-muted-foreground" />
      {line.windows.map((window, index) => (
        <span key={window.label} className="flex min-w-0 items-center gap-1.5">
          {index > 0 ? <Separator /> : null}
          <span className="truncate">
            {window.label} {window.remainingPercent}%
            {window.resetsIn ? ` · ${window.resetsIn}` : ""}
          </span>
        </span>
      ))}
      {line.windows.length > 0 && line.cache ? <Separator /> : null}
      {line.cache ? (
        <span className={cn("shrink-0", cacheExpired && "text-destructive")}>
          Cache {line.cache.remaining ?? "–"}
        </span>
      ) : null}
    </div>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" className="text-muted-foreground">
      |
    </span>
  );
}
