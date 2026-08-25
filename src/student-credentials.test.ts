import { describe, expect, it } from "vitest";
import {
  COUNCIL_ACCOUNT_IDS,
  getDefaultStudentCredentials,
} from "./student-credentials";

describe("default student credentials", () => {
  it("provides one hashed credential for every council account", () => {
    const credentials = getDefaultStudentCredentials();

    expect(credentials.map(({ id }) => id)).toEqual(COUNCIL_ACCOUNT_IDS);
    expect(new Set(credentials.map(({ salt }) => salt)).size).toBe(9);
    credentials.forEach((credential) => {
      expect(credential.salt).toMatch(/^[a-f0-9]{32}$/);
      expect(credential.passwordHash).toMatch(/^[a-f0-9]{64}$/);
      expect(credential).not.toHaveProperty("password");
    });
  });

  it("returns a new array so admin changes cannot mutate the defaults", () => {
    const first = getDefaultStudentCredentials();
    const second = getDefaultStudentCredentials();

    first.splice(0, 1);
    expect(second).toHaveLength(9);
  });
});
