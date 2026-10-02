import { createCipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_ROOT = mkdtempSync(path.join(os.tmpdir(), "employee-docs-test-"));
process.env.EMPLOYEE_STORAGE_ROOT = TMP_ROOT;
delete process.env.EMPLOYEE_STORAGE_DRIVER;

const TEST_KEY = randomBytes(32).toString("hex");
const HR_SESSION = { id: "u_hr", email: "hr@example.com", role: "hr", employeeId: 1 };
const EMPLOYEE_SESSION = { id: "u_emp", email: "emp@example.com", role: "employee", employeeId: 42 };

const auth = vi.hoisted(() => ({ session: {} as Record<string, unknown> }));

const db = vi.hoisted(() => {
  const statutoryUpsert = vi.fn();
  const statutoryFindUnique = vi.fn();
  const docCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "doc_1", ...data }));
  const docUpdate = vi.fn();
  const docFindUnique = vi.fn();
  const tx = {
    employeeStatutoryDetail: { upsert: statutoryUpsert },
    employeeDocument: { create: docCreate, update: docUpdate },
  };
  return {
    statutoryUpsert,
    statutoryFindUnique,
    docCreate,
    docUpdate,
    docFindUnique,
    prisma: {
      employee: { findUnique: vi.fn(async () => ({ id: 42 })) },
      employeeStatutoryDetail: { findUnique: statutoryFindUnique },
      employeeDocument: { findUnique: docFindUnique },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

type SentMail = { to: string; subject: string; text: string; html: string };
const mail = vi.hoisted(() => ({
  transportAvailable: true,
  sendMail: vi.fn(async (_message: SentMail) => ({ messageId: "m1" })),
}));

const audit = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/auth-guards", () => ({
  getSessionOrThrow: vi.fn(async () => auth.session),
  requireManageEmployeeSession: vi.fn(async () => auth.session),
}));
vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    EMPLOYEE_STATUTORY_UPDATED: "employee.statutory.updated",
    EMPLOYEE_STATUTORY_VIEWED: "employee.statutory.viewed",
    DOCUMENT_UPLOADED: "document.uploaded",
    DOCUMENT_DELETED: "document.deleted",
    DOCUMENT_DOWNLOADED: "document.downloaded",
  },
  writeAuditLog: audit.writeAuditLog,
}));
vi.mock("@/lib/security/request-context", () => ({
  getRequestSecurityContext: vi.fn(async () => ({})),
}));
vi.mock("@/lib/notifications/channels/email-channel", () => ({
  getTransporter: vi.fn(() => (mail.transportAvailable ? { sendMail: mail.sendMail } : null)),
}));
vi.mock("@/lib/notifications/recipient-resolver", () => ({
  getEmployeeUserEmail: vi.fn(async () => ({ email: "priya@example.com", name: "Priya <R>" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  revealStatutoryDetailsAction,
  upsertEmployeeStatutoryDetailAction,
} from "@/actions/employee-statutory";
import { deleteEmployeeDocumentAction, uploadEmployeeDocumentAction } from "@/actions/employee-documents";
import { GET as downloadDocument } from "@/app/api/employee-documents/download/route";
import { validateApplicationConfig } from "@/lib/config/validate";
import { decryptField, encryptField } from "@/lib/security/field-encryption";
import { maskStatutoryDetail, readStatutoryDetail } from "@/lib/security/statutory-details";
import {
  EMPLOYEE_DOCUMENT_MAX_BYTES,
  checkEmployeeDocumentFile,
} from "@/lib/validation/schemas/employee-document";

/** Same wire format as encryptField, but under a different key (e.g. another environment's). */
function encryptWithOtherKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", randomBytes(32), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

function emptyRow() {
  return {
    panEnc: null,
    aadhaarEnc: null,
    uanEnc: null,
    esiNumberEnc: null,
    bankAccountNoEnc: null,
    ifscEnc: null,
    bankName: null,
    bankBranchName: null,
  };
}

function statutoryForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const values: Record<string, string> = {
    employeeId: "42",
    pan: "abcde1234f",
    aadhaar: "1234 5678 9012",
    uan: "",
    esiNumber: "",
    bankAccountNo: "001122334455",
    ifsc: "hdfc0001234",
    bankName: "HDFC Bank",
    bankBranchName: "",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

/** Uploads a small PDF for employee 42 through the real action and returns its storage key. */
async function uploadSample(): Promise<string> {
  const fd = new FormData();
  fd.set("employeeId", "42");
  fd.set("documentType", "PAN_CARD");
  fd.set("file", new File([Buffer.from("%PDF-1.4 test")], "PAN card.pdf", { type: "application/pdf" }));
  const result = await uploadEmployeeDocumentAction({}, fd);
  expect(result).toEqual({ success: "Document uploaded successfully." });
  return db.docCreate.mock.calls[0][0].data.storageKey as string;
}

afterAll(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY = TEST_KEY;
  auth.session = HR_SESSION;
  mail.transportAvailable = true;
  mail.sendMail.mockClear();
  audit.writeAuditLog.mockClear();
  db.statutoryUpsert.mockReset();
  db.statutoryFindUnique.mockReset().mockResolvedValue(null);
  db.docCreate.mockClear();
  db.docUpdate.mockReset();
  db.docFindUnique.mockReset();
});

describe("startup config check", () => {
  const keyWarning = () =>
    validateApplicationConfig().issues.some(
      (i) => i.field === "EMPLOYEE_FIELD_ENCRYPTION_KEY" && i.level === "warning"
    );

  it("warns (without failing startup) when the key is missing or malformed", () => {
    delete process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY;
    expect(keyWarning()).toBe(true);
    expect(
      validateApplicationConfig().issues.some(
        (i) => i.field === "EMPLOYEE_FIELD_ENCRYPTION_KEY" && i.level === "error"
      )
    ).toBe(false);

    process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY = "abc123";
    expect(keyWarning()).toBe(true);

    process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY = TEST_KEY;
    expect(keyWarning()).toBe(false);
  });
});

describe("readStatutoryDetail", () => {
  it("reports missing_key when the key is not configured, even with no row", () => {
    delete process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY;
    expect(readStatutoryDetail(null)).toEqual({ problem: "missing_key", plain: null });
  });

  it("reports missing_key for a malformed key", () => {
    process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY = "not-a-hex-key";
    expect(readStatutoryDetail(null).problem).toBe("missing_key");
  });

  it("decrypts values and masks them", () => {
    const result = readStatutoryDetail({
      ...emptyRow(),
      panEnc: encryptField("ABCDE1234F"),
      bankAccountNoEnc: encryptField("001122334455"),
      bankName: "HDFC Bank",
    });
    expect(result.problem).toBeNull();
    expect(result.plain).toMatchObject({ pan: "ABCDE1234F", bankAccountNo: "001122334455", aadhaar: null });
    expect(maskStatutoryDetail(result.plain!)).toMatchObject({
      pan: "XXXXX1234F",
      bankAccountNo: "XXXXXXXX4455",
      bankName: "HDFC Bank",
    });
  });

  it("reports undecryptable instead of throwing when values were saved under another key", () => {
    const result = readStatutoryDetail({ ...emptyRow(), panEnc: encryptWithOtherKey("ABCDE1234F") });
    expect(result).toEqual({ problem: "undecryptable", plain: null });
  });
});

describe("upsertEmployeeStatutoryDetailAction", () => {
  it("returns a clear error and writes nothing when the key is missing", async () => {
    delete process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY;
    const result = await upsertEmployeeStatutoryDetailAction({}, statutoryForm());
    expect(result.error).toMatch(/encryption key isn't configured/);
    expect(db.statutoryUpsert).not.toHaveBeenCalled();
  });

  it("refuses to overwrite values saved under a different key", async () => {
    db.statutoryFindUnique.mockResolvedValue({ ...emptyRow(), panEnc: encryptWithOtherKey("ABCDE1234F") });
    const result = await upsertEmployeeStatutoryDetailAction({}, statutoryForm());
    expect(result.error).toMatch(/different encryption key/);
    expect(db.statutoryUpsert).not.toHaveBeenCalled();
  });

  it("stores only ciphertext for sensitive fields and normalizes input", async () => {
    db.statutoryFindUnique.mockResolvedValue({ ...emptyRow(), panEnc: encryptField("ZZZZZ9999Z") });
    const result = await upsertEmployeeStatutoryDetailAction({}, statutoryForm());
    expect(result.success).toBeTruthy();

    const row = db.statutoryUpsert.mock.calls[0][0].update;
    expect(row.panEnc).not.toContain("ABCDE1234F");
    expect(decryptField(row.panEnc)).toBe("ABCDE1234F");
    expect(decryptField(row.aadhaarEnc)).toBe("123456789012");
    expect(decryptField(row.ifscEnc)).toBe("HDFC0001234");
    expect(row.uanEnc).toBeNull();
    expect(row.bankName).toBe("HDFC Bank");
  });

  it("emails the employee, showing only the last 4 digits, when the bank account changes", async () => {
    const result = await upsertEmployeeStatutoryDetailAction({}, statutoryForm());
    expect(result.success).toMatch(/employee was emailed/);
    expect(mail.sendMail).toHaveBeenCalledTimes(1);

    const message = mail.sendMail.mock.calls[0][0];
    expect(message.to).toBe("priya@example.com");
    expect(message.text).toContain("XXXXXXXX4455");
    expect(message.text).toContain("hr@example.com");
    expect(message.text).not.toContain("001122334455");
    expect(message.html).toContain("Priya &lt;R&gt;");
  });

  it("doesn't email when the bank account and IFSC are unchanged", async () => {
    db.statutoryFindUnique.mockResolvedValue({
      ...emptyRow(),
      bankAccountNoEnc: encryptField("001122334455"),
      ifscEnc: encryptField("HDFC0001234"),
    });
    const result = await upsertEmployeeStatutoryDetailAction({}, statutoryForm({ pan: "ZZZZZ9999Z" }));
    expect(result).toEqual({ success: "Statutory details saved successfully." });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it("still saves, and says so, when the email can't be sent", async () => {
    mail.transportAvailable = false;
    const result = await upsertEmployeeStatutoryDetailAction({}, statutoryForm());
    expect(result.success).toMatch(/couldn't be sent/);
    expect(db.statutoryUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("revealStatutoryDetailsAction", () => {
  const storedRow = () => ({ ...emptyRow(), panEnc: encryptField("ABCDE1234F") });

  it("returns values to HR and records exactly one audit entry", async () => {
    db.statutoryFindUnique.mockResolvedValue(storedRow());
    const result = await revealStatutoryDetailsAction(42);
    expect(result).toMatchObject({ values: { pan: "ABCDE1234F" } });
    expect(audit.writeAuditLog).toHaveBeenCalledTimes(1);
    expect(audit.writeAuditLog.mock.calls[0][0]).toMatchObject({
      action: "employee.statutory.viewed",
      employeeId: 42,
      metadata: { ownRecord: false },
    });
  });

  it("lets employees reveal their own details", async () => {
    auth.session = EMPLOYEE_SESSION;
    db.statutoryFindUnique.mockResolvedValue(storedRow());
    const result = await revealStatutoryDetailsAction(42);
    expect(result).toMatchObject({ values: { pan: "ABCDE1234F" } });
    expect(audit.writeAuditLog.mock.calls[0][0].metadata).toEqual({ ownRecord: true });
  });

  it("refuses another employee's details without reading or logging anything", async () => {
    auth.session = EMPLOYEE_SESSION;
    const result = await revealStatutoryDetailsAction(7);
    expect(result).toEqual({ error: "You don't have access to these details." });
    expect(db.statutoryFindUnique).not.toHaveBeenCalled();
    expect(audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("doesn't log a view when nothing is stored", async () => {
    const result = await revealStatutoryDetailsAction(42);
    expect(result).toMatchObject({ values: { pan: null } });
    expect(audit.writeAuditLog).not.toHaveBeenCalled();
  });
});

describe("employee documents", () => {
  it("allows files up to the limit and rejects larger ones or other types", () => {
    expect(checkEmployeeDocumentFile("id.pdf", "application/pdf", EMPLOYEE_DOCUMENT_MAX_BYTES)).toBeNull();
    expect(checkEmployeeDocumentFile("id.pdf", "application/pdf", EMPLOYEE_DOCUMENT_MAX_BYTES + 1)).toMatch(
      /4MB/
    );
    expect(checkEmployeeDocumentFile("scan.JPG", "image/jpeg", 1000)).toBeNull();
    expect(checkEmployeeDocumentFile("tool.exe", "application/x-msdownload", 1000)).toMatch(/not allowed/);
  });

  it("stays under the Server Action body limit in next.config", () => {
    expect(EMPLOYEE_DOCUMENT_MAX_BYTES).toBeLessThan(5 * 1024 * 1024);
  });

  it("writes the file under employees/<id>/documents and records its key", async () => {
    const storageKey = await uploadSample();
    expect(storageKey).toMatch(/^employees\/42\/documents\/[0-9a-f-]{36}-PAN_card\.pdf$/);
    const onDisk = path.join(TMP_ROOT, storageKey);
    expect(existsSync(onDisk)).toBe(true);
    expect(readFileSync(onDisk).toString()).toBe("%PDF-1.4 test");
  });

  it("rejects an oversized upload server-side without storing anything", async () => {
    const fd = new FormData();
    fd.set("employeeId", "42");
    fd.set("documentType", "OTHER");
    fd.set("file", new File([Buffer.alloc(EMPLOYEE_DOCUMENT_MAX_BYTES + 1)], "big.pdf", { type: "application/pdf" }));

    const result = await uploadEmployeeDocumentAction({}, fd);
    expect(result.error).toMatch(/4MB/);
    expect(db.docCreate).not.toHaveBeenCalled();
  });

  it("deleting a document removes the file from storage", async () => {
    const storageKey = await uploadSample();
    db.docFindUnique.mockResolvedValue({
      id: "doc_1",
      employeeId: 42,
      deletedAt: null,
      storageKey,
      documentType: "PAN_CARD",
      fileName: "PAN card.pdf",
    });
    const fd = new FormData();
    fd.set("id", "doc_1");
    fd.set("employeeId", "42");

    const result = await deleteEmployeeDocumentAction({}, fd);
    expect(result).toEqual({ success: "Document deleted successfully." });
    expect(db.docUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(existsSync(path.join(TMP_ROOT, storageKey))).toBe(false);
  });

  it("employees can download their own documents and get 404 for anyone else's", async () => {
    const storageKey = await uploadSample();
    const request = () => new Request("http://localhost/api/employee-documents/download?id=doc_1");
    const docFor = (employeeId: number) => ({
      id: "doc_1",
      employeeId,
      deletedAt: null,
      storageKey,
      documentType: "PAN_CARD",
      fileName: "PAN card.pdf",
      mimeType: "application/pdf",
    });

    auth.session = EMPLOYEE_SESSION;
    db.docFindUnique.mockResolvedValue(docFor(42));
    const own = await downloadDocument(request());
    expect(own.status).toBe(200);
    expect(Buffer.from(await own.arrayBuffer()).toString()).toBe("%PDF-1.4 test");

    db.docFindUnique.mockResolvedValue(docFor(7));
    expect((await downloadDocument(request())).status).toBe(404);

    auth.session = HR_SESSION;
    expect((await downloadDocument(request())).status).toBe(200);
  });
});
