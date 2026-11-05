import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_EXPIRED_EVENT,
  getServerToken,
  installServerAuth,
  serverLogin,
} from "./server-auth";

const API =
  "https://script.google.com/macros/s/AKfycbwfmqSlIqJ0-2CoAQ1Uv7nrL47x3zsqToUWP0brNiHBnJGFIvz450w33ANBmltvOjNPTg/exec";

const jsonResponse = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const makeStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
};

describe("server-auth", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
    const target = new EventTarget();
    vi.stubGlobal("window", {
      fetch: undefined,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    });
  });

  it("stores the token after a successful login and reports not_configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: "success",
          token: "t".repeat(72),
          role: "admin",
          expiresInSeconds: 21600,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: "error", code: "not_configured", message: "x" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const ok = await serverLogin({ role: "admin", password: "secret1" });
    expect(ok.ok).toBe(true);
    expect(getServerToken()).toBe("t".repeat(72));

    const missing = await serverLogin({
      role: "student",
      id: "สภา01",
      password: "secret1",
    });
    expect(missing).toMatchObject({ ok: false, code: "not_configured" });
  });

  it("adds the token to data API writes and signals expired sessions", async () => {
    localStorage.setItem(
      "cleaning_server_session",
      JSON.stringify({
        token: "a".repeat(72),
        role: "admin",
        expiresAt: Date.now() + 60_000,
      })
    );
    const inner = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: "error", code: "unauthenticated" })
      );
    vi.stubGlobal("fetch", inner);
    // installServerAuth wraps whatever window.fetch is at call time.
    (window as unknown as { fetch: typeof fetch }).fetch =
      inner as unknown as typeof fetch;
    installServerAuth();

    const expired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    await window.fetch(API, {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: "1" }),
    });

    const sent = JSON.parse(String(inner.mock.calls[0][1]?.body));
    expect(sent).toMatchObject({ action: "delete", token: "a".repeat(72) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(expired).toHaveBeenCalled();
    expect(getServerToken()).toBeNull();
  });
});
