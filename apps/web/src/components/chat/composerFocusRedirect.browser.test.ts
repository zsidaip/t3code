import { expect, it } from "vite-plus/test";

import { shouldTypeToFocusComposer } from "./composerFocusRedirect";

function typeFromClosedShadowInput(hostAttribute?: string): boolean {
  const host = document.createElement("div");
  if (hostAttribute) host.setAttribute(hostAttribute, "");
  document.body.append(host);
  const input = document.createElement("input");
  host.attachShadow({ mode: "closed" }).append(input);
  let redirected: boolean | null = null;
  const listener = (event: KeyboardEvent) => {
    redirected = shouldTypeToFocusComposer(event);
  };
  window.addEventListener("keydown", listener, true);
  try {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, composed: true }));
  } finally {
    window.removeEventListener("keydown", listener, true);
    host.remove();
  }
  return redirected ?? true;
}

it("does not steal typing from the preview annotation overlay's closed shadow root", () => {
  expect(typeFromClosedShadowInput("data-t3code-annotation-ui")).toBe(false);
});

it("still redirects typing from an unmarked closed shadow host", () => {
  expect(typeFromClosedShadowInput()).toBe(true);
});
