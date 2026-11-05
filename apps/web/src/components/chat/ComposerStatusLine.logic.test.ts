import type { UsageLimitsReport } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveComposerStatusLine } from "./ComposerStatusLine.logic";

const NOW = Date.parse("2026-11-05T10:00:00.000Z");

const report = (windows: unknown[], unavailable?: unknown): UsageLimitsReport =>
  ({
    createdAt: "2026-11-05T10:00:00.000Z",
    notices: [],
    accounts: [
      {
        id: "a",
        driver: "claudeAgent",
        label: "Claude",
        limits: { checkedAt: "2026-11-05T10:00:00.000Z", windows, unavailable },
      },
    ],
  }) as unknown as UsageLimitsReport;

describe("deriveComposerStatusLine", () => {
  it("shows remaining percent and reset countdown per window", () => {
    const line = deriveComposerStatusLine({
      report: report([
        {
          id: "w",
          kind: "weekly",
          label: "W",
          usedPercent: 13,
          resetsAt: "2026-11-11T11:00:00.000Z",
        },
        {
          id: "s",
          kind: "session",
          label: "S",
          usedPercent: 11,
          resetsAt: "2026-11-05T13:04:30.000Z",
        },
      ]),
      instanceId: null,
      liveUsage: null,
      promptCacheSupported: false,
      now: NOW,
    });
    expect(line).toEqual({
      windows: [
        { label: "Session", remainingPercent: 89, resetsIn: "3h 4m" },
        { label: "Weekly", remainingPercent: 87, resetsIn: "6d 1h" },
      ],
      cache: null,
    });
  });

  it("counts down the prompt cache and dashes it once expired", () => {
    const live = (updatedAt: string) => ({ promptCacheTtlMs: 300_000, updatedAt });
    expect(
      deriveComposerStatusLine({
        report: null,
        instanceId: null,
        liveUsage: live("2026-11-05T09:58:00.000Z"),
        promptCacheSupported: false,
        now: NOW,
      })?.cache,
    ).toEqual({ remaining: "3m" });
    expect(
      deriveComposerStatusLine({
        report: null,
        instanceId: null,
        liveUsage: live("2026-11-05T09:50:00.000Z"),
        promptCacheSupported: false,
        now: NOW,
      })?.cache,
    ).toEqual({ remaining: null });
    expect(
      deriveComposerStatusLine({
        report: null,
        instanceId: null,
        liveUsage: {
          ...live("2026-11-05T09:58:00.000Z"),
          promptCacheExpiresAt: "2026-11-05T10:01:00.000Z",
        },
        promptCacheSupported: false,
        now: NOW,
      })?.cache,
    ).toEqual({ remaining: "1m" });
    expect(
      deriveComposerStatusLine({
        report: null,
        instanceId: null,
        liveUsage: null,
        promptCacheSupported: true,
        now: NOW,
      })?.cache,
    ).toEqual({ remaining: null });
  });

  it("hides when no usable limits and no cache info", () => {
    expect(
      deriveComposerStatusLine({
        report: report([{ id: "s", kind: "session", label: "S", usedPercent: 5 }], {
          reason: "probeFailed",
        }),
        instanceId: null,
        liveUsage: null,
        promptCacheSupported: false,
        now: NOW,
      }),
    ).toBeNull();
  });
});
