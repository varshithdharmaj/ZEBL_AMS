import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { requireServerSecret } from "@/lib/config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = requireServerSecret("EMPLOYEE_FIELD_ENCRYPTION_KEY");
  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `EMPLOYEE_FIELD_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (64 hex chars); got ${key.length}.`,
    );
  }
  cachedKey = key;
  return key;
}

/** Encrypts a non-empty plaintext string. Callers must not pass empty/null values. */
export function encryptField(plaintext: string): string {
  if (!plaintext) {
    throw new Error("encryptField requires a non-empty string.");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

/** Decrypts a value produced by encryptField. Throws if the ciphertext is malformed or tampered. */
export function decryptField(ciphertext: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("decryptField received a malformed ciphertext.");
  }
  const [ivPart, authTagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");
  const data = Buffer.from(dataPart, "base64");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}
