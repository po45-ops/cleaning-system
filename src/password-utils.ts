export type PasswordVerifier = {
  salt: string;
  passwordHash: string;
};

export const PASSWORD_HASH_ITERATIONS = 120_000;

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const derivePasswordHash = async (
  password: string,
  salt: string
): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับการเก็บรหัสอย่างปลอดภัย");
  }
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
};

export const createPasswordVerifier = async (
  password: string
): Promise<PasswordVerifier> => {
  const saltBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(saltBytes);
  const salt = bytesToHex(saltBytes);
  return { salt, passwordHash: await derivePasswordHash(password, salt) };
};

export const verifyPassword = async (
  password: string,
  verifier: PasswordVerifier
): Promise<boolean> =>
  (await derivePasswordHash(password, verifier.salt)) === verifier.passwordHash;
