import type { UsageLimitsReport } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  cacheFraction,
  cacheTone,
  compactDuration,
  deriveComposerStatusLine,
} from "./ComposerStatusLine.logic";

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

describe("compactDuration", () => {
  it.each([
    [0, "0m"],
    [59_999, "0m"],
    [52 * 60_000, "52m"],
    [60 * 60_000, "1h"],
    [(3 * 60 + 56) * 60_000, "3h56m"],
    [(23 * 60 + 59) * 60_000, "23h59m"],
    [24 * 60 * 60_000, "1d"],
    [(5 * 24 + 2) * 60 * 60_000, "5d2h"],
    [(5 * 24 + 2) * 60 * 60_000 + 30 * 60_000, "5d2h"],
  ])("formats %dms as %s", (ms, expected) => {
    expect(compactDuration(ms)).toBe(expected);
  });
});

describe("cacheFraction", () => {
  it.each([
    [150_000, 300_000, 0.5],
    [300_000, 300_000, 1],
    [400_000, 300_000, 1],
    [-1, 300_000, 0],
    [10, 0, 0],
  ])("%dms left of %dms is %d", (left, ttl, expected) => {
    expect(cacheFraction(left, ttl)).toBe(expected);
  });
});

describe("cacheTone", () => {
  it.each([
    [1, false, "good"],
    [0.9, false, "good"],
    [0.89, false, "normal"],
    [0.2, false, "normal"],
    [0.19, false, "warning"],
    [0, true, "critical"],
    [0.9, true, "critical"],
  ] as const)("fraction %d expired=%s is %s", (fraction, expired, expected) => {
    expect(cacheTone(fraction, expired)).toBe(expected);
  });
});

describe("deriveComposerStatusLine", () => {
  it("shows remaining percent and reset countdown per window", () => {
    const line = deriveComposerStatusLine({
      report: report([
        {
          id: "w",
          kind: "weekly",
          label: "Weekly",
          usedPercent: 13,
          resetsAt: "2026-11-11T11:00:00.000Z",
        },
        {
          id: "s",
          kind: "session",
          label: "Session",
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
        {
          label: "Session",
          usedPercent: 11,
          resetsIn: { short: "3h4m", long: "3h 4m" },
        },
        {
          label: "Weekly",
          usedPercent: 13,
          resetsIn: { short: "6d1h", long: "6d 1h" },
        },
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
    ).toEqual({ remaining: { short: "3m", long: "3m" }, fraction: 0.6 });
    expect(
      deriveComposerStatusLine({
        report: null,
        instanceId: null,
        liveUsage: live("2026-11-05T09:50:00.000Z"),
        promptCacheSupported: false,
        now: NOW,
      })?.cache,
    ).toEqual({ remaining: null, fraction: 0 });
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
    ).toEqual({ remaining: { short: "1m", long: "1m" }, fraction: 0.2 });
    expect(
      deriveComposerStatusLine({
        report: null,
        instanceId: null,
        liveUsage: null,
        promptCacheSupported: true,
        now: NOW,
      })?.cache,
    ).toEqual({ remaining: null, fraction: 0 });
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
