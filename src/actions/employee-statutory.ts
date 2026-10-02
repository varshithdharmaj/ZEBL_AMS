"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { prisma } from "@/lib/prisma";
import { getSessionOrThrow, requireManageEmployeeSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { canViewUnmaskedStatutoryDetails } from "@/lib/permissions";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { employeeStatutoryDetailSchema } from "@/lib/validation/schemas/employee-statutory";
import { encryptField, isFieldEncryptionConfigured } from "@/lib/security/field-encryption";
import { readStatutoryDetail, type StatutoryFields } from "@/lib/security/statutory-details";
import { sendBankDetailsChangedEmail } from "@/lib/security/bank-details-change-email";
import { getRequestSecurityContext } from "@/lib/security/request-context";

function encryptOrNull(value: string | null): string | null {
  return value ? encryptField(value) : null;
}

export async function upsertEmployeeStatutoryDetailAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireManageEmployeeSession();

    const parsed = safeParseWithSchema(employeeStatutoryDetailSchema, {
      employeeId: formData.get("employeeId"),
      pan: formData.get("pan"),
      aadhaar: formData.get("aadhaar"),
      uan: formData.get("uan"),
      esiNumber: formData.get("esiNumber"),
      bankAccountNo: formData.get("bankAccountNo"),
      ifsc: formData.get("ifsc"),
      bankName: formData.get("bankName"),
      bankBranchName: formData.get("bankBranchName"),
    });
    if (!parsed.ok) return { error: parsed.error };
    const data = parsed.data;

    if (!isFieldEncryptionConfigured()) {
      return {
        error:
          "Statutory details can't be saved because the server's encryption key isn't configured. Ask your system administrator to set EMPLOYEE_FIELD_ENCRYPTION_KEY.",
      };
    }

    const [employee, existing] = await Promise.all([
      prisma.employee.findUnique({ where: { id: data.employeeId } }),
      prisma.employeeStatutoryDetail.findUnique({ where: { employeeId: data.employeeId } }),
    ]);
    if (!employee) return { error: "Employee not found." };
    const previous = existing ? readStatutoryDetail(existing) : null;
    // Never overwrite values this key can't read: on a shared database they may belong to
    // another environment's key, and the upsert below replaces every column.
    if (previous?.problem) {
      return {
        error:
          "Existing statutory details were saved with a different encryption key, so they can't be changed here. Check that EMPLOYEE_FIELD_ENCRYPTION_KEY matches the key used when they were saved.",
      };
    }
    const bankDetailsChanged =
      data.bankAccountNo !== null &&
      (data.bankAccountNo !== (previous?.plain?.bankAccountNo ?? null) ||
        data.ifsc !== (previous?.plain?.ifsc ?? null));

    const encryptedData = {
      panEnc: encryptOrNull(data.pan),
      aadhaarEnc: encryptOrNull(data.aadhaar),
      uanEnc: encryptOrNull(data.uan),
      esiNumberEnc: encryptOrNull(data.esiNumber),
      bankAccountNoEnc: encryptOrNull(data.bankAccountNo),
      ifscEnc: encryptOrNull(data.ifsc),
      bankName: data.bankName,
      bankBranchName: data.bankBranchName,
    };

    const fieldsWithValue = Object.entries({
      pan: data.pan,
      aadhaar: data.aadhaar,
      uan: data.uan,
      esiNumber: data.esiNumber,
      bankAccountNo: data.bankAccountNo,
      ifsc: data.ifsc,
      bankName: data.bankName,
      bankBranchName: data.bankBranchName,
    })
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);

    const requestContext = await getRequestSecurityContext();
    await prisma.$transaction(async (tx) => {
      await tx.employeeStatutoryDetail.upsert({
        where: { employeeId: data.employeeId },
        create: { employeeId: data.employeeId, updatedByUserId: session.id, ...encryptedData },
        update: { updatedByUserId: session.id, ...encryptedData },
      });

      await writeAuditLog(
        {
          entityType: "employee",
          entityId: String(data.employeeId),
          action: AUDIT_ACTIONS.EMPLOYEE_STATUTORY_UPDATED,
          actorUserId: session.id,
          actorEmail: session.email,
          employeeId: data.employeeId,
          module: "employees",
          description: "Employee statutory details were updated.",
          metadata: { fieldsWithValue, bankDetailsChanged },
          requestContext,
        },
        tx
      );
    });

    revalidatePath(`/admin/employees/${data.employeeId}`);
    if (!bankDetailsChanged || !data.bankAccountNo) {
      return { success: "Statutory details saved successfully." };
    }

    const emailed = await sendBankDetailsChangedEmail({
      employeeId: data.employeeId,
      bankAccountNo: data.bankAccountNo,
      ifsc: data.ifsc,
      changedByEmail: session.email,
    });
    return {
      success: emailed
        ? "Statutory details saved. The employee was emailed about the bank account change."
        : "Statutory details saved, but the email telling the employee about the bank account change couldn't be sent.",
    };
  } catch (error) {
    console.error("[employee-statutory] save failed:", error instanceof Error ? error.message : error);
    return { error: "Failed to save statutory details." };
  }
}

export type RevealStatutoryResult = { values: StatutoryFields } | { error: string };

/**
 * Returns one employee's unmasked statutory details for the "Show unmasked" button and
 * records the view, so the audit log reflects real views instead of every page load.
 */
export async function revealStatutoryDetailsAction(
  employeeId: number
): Promise<RevealStatutoryResult> {
  try {
    const session = await getSessionOrThrow();
    if (!Number.isInteger(employeeId) || employeeId <= 0) return { error: "Invalid employee." };
    const allowed = canViewUnmaskedStatutoryDetails({
      actorRole: session.role,
      actorEmployeeId: session.employeeId,
      targetEmployeeId: employeeId,
    });
    if (!allowed) return { error: "You don't have access to these details." };

    const row = await prisma.employeeStatutoryDetail.findUnique({ where: { employeeId } });
    const { plain } = readStatutoryDetail(row);
    if (!plain) return { error: "These details can't be shown right now." };

    if (row) {
      await writeAuditLog({
        entityType: "employee",
        entityId: String(employeeId),
        action: AUDIT_ACTIONS.EMPLOYEE_STATUTORY_VIEWED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId,
        module: "employees",
        description: "Employee statutory details were viewed unmasked.",
        metadata: { ownRecord: session.employeeId === employeeId },
        requestContext: await getRequestSecurityContext(),
      });
    }
    return { values: plain };
  } catch (error) {
    console.error("[employee-statutory] reveal failed:", error instanceof Error ? error.message : error);
    return { error: "Couldn't load the details. Please try again." };
  }
}
