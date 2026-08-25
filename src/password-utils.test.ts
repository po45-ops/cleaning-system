import { describe, expect, it } from "vitest";
import {
  createPasswordVerifier,
  PASSWORD_HASH_ITERATIONS,
  verifyPassword,
} from "./password-utils";

describe("password verifier", () => {
  it("uses a work factor suitable for an interim local screen lock", () => {
    expect(PASSWORD_HASH_ITERATIONS).toBeGreaterThanOrEqual(100_000);
  });

  it("stores only a salted hash and verifies the matching value", async () => {
    const secret = "temporary-device-secret";
    const verifier = await createPasswordVerifier(secret);

    expect(verifier.passwordHash).not.toContain(secret);
    expect(verifier.salt).toHaveLength(32);
    await expect(verifyPassword(secret, verifier)).resolves.toBe(true);
    await expect(verifyPassword("wrong-value", verifier)).resolves.toBe(false);
  });

  it("generates a different salt for each enrollment", async () => {
    const first = await createPasswordVerifier("same-value");
    const second = await createPasswordVerifier("same-value");
    expect(first.salt).not.toBe(second.salt);
    expect(first.passwordHash).not.toBe(second.passwordHash);
  });
});
