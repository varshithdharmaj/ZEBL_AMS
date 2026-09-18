"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { prisma } from "@/lib/prisma";
import { requireManageEmployeeSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { employeeStatutoryDetailSchema } from "@/lib/validation/schemas/employee-statutory";
import { encryptField } from "@/lib/security/field-encryption";
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
      pfNumber: formData.get("pfNumber"),
      esiNumber: formData.get("esiNumber"),
      bankAccountNo: formData.get("bankAccountNo"),
      ifsc: formData.get("ifsc"),
      bankName: formData.get("bankName"),
    });
    if (!parsed.ok) return { error: parsed.error };
    const data = parsed.data;

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) return { error: "Employee not found." };

    const encryptedData = {
      panEnc: encryptOrNull(data.pan),
      aadhaarEnc: encryptOrNull(data.aadhaar),
      uanEnc: encryptOrNull(data.uan),
      pfNumberEnc: encryptOrNull(data.pfNumber),
      esiNumberEnc: encryptOrNull(data.esiNumber),
      bankAccountNoEnc: encryptOrNull(data.bankAccountNo),
      ifscEnc: encryptOrNull(data.ifsc),
      bankName: data.bankName,
    };

    const fieldsWithValue = Object.entries({
      pan: data.pan,
      aadhaar: data.aadhaar,
      uan: data.uan,
      pfNumber: data.pfNumber,
      esiNumber: data.esiNumber,
      bankAccountNo: data.bankAccountNo,
      ifsc: data.ifsc,
      bankName: data.bankName,
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
          metadata: { fieldsWithValue },
          requestContext,
        },
        tx
      );
    });

    revalidatePath(`/admin/employees/${data.employeeId}`);
    return { success: "Statutory details saved successfully." };
  } catch {
    return { error: "Failed to save statutory details." };
  }
}
