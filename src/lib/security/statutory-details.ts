import { decryptField, isFieldEncryptionConfigured } from "@/lib/security/field-encryption";
import { maskAadhaar, maskBankAccount, maskPan } from "@/lib/security/field-masking";

export type StatutoryFields = {
  pan: string | null;
  aadhaar: string | null;
  uan: string | null;
  esiNumber: string | null;
  bankAccountNo: string | null;
  ifsc: string | null;
  bankName: string | null;
  bankBranchName: string | null;
};

/** Why statutory details can't be shown or saved right now. */
export type StatutoryDetailProblem = "missing_key" | "undecryptable";

type EncryptedStatutoryRow = {
  panEnc: string | null;
  aadhaarEnc: string | null;
  uanEnc: string | null;
  esiNumberEnc: string | null;
  bankAccountNoEnc: string | null;
  ifscEnc: string | null;
  bankName: string | null;
  bankBranchName: string | null;
};

type StatutoryReadResult =
  | { problem: null; plain: StatutoryFields }
  | { problem: StatutoryDetailProblem; plain: null };

function decryptOrNull(value: string | null): string | null {
  return value ? decryptField(value) : null;
}

/**
 * Decrypts a stored row without throwing, so a missing or mismatched
 * EMPLOYEE_FIELD_ENCRYPTION_KEY degrades the Statutory tab instead of crashing
 * the whole employee profile page. A missing key is reported even when no row
 * exists yet, because saving would fail too.
 */
export function readStatutoryDetail(row: EncryptedStatutoryRow | null): StatutoryReadResult {
  if (!isFieldEncryptionConfigured()) return { problem: "missing_key", plain: null };
  try {
    return {
      problem: null,
      plain: {
        pan: decryptOrNull(row?.panEnc ?? null),
        aadhaar: decryptOrNull(row?.aadhaarEnc ?? null),
        uan: decryptOrNull(row?.uanEnc ?? null),
        esiNumber: decryptOrNull(row?.esiNumberEnc ?? null),
        bankAccountNo: decryptOrNull(row?.bankAccountNoEnc ?? null),
        ifsc: decryptOrNull(row?.ifscEnc ?? null),
        bankName: row?.bankName ?? null,
        bankBranchName: row?.bankBranchName ?? null,
      },
    };
  } catch {
    // Wrong key (e.g. rotated, or another environment's key on a shared DB) or tampered ciphertext.
    return { problem: "undecryptable", plain: null };
  }
}

export function maskStatutoryDetail(plain: StatutoryFields): StatutoryFields {
  return {
    pan: plain.pan ? maskPan(plain.pan) : null,
    aadhaar: plain.aadhaar ? maskAadhaar(plain.aadhaar) : null,
    uan: plain.uan ? maskAadhaar(plain.uan) : null,
    esiNumber: plain.esiNumber ? maskBankAccount(plain.esiNumber) : null,
    bankAccountNo: plain.bankAccountNo ? maskBankAccount(plain.bankAccountNo) : null,
    ifsc: plain.ifsc,
    bankName: plain.bankName,
    bankBranchName: plain.bankBranchName,
  };
}
