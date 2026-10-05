"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  shiftCreateSchema,
  shiftUpdateSchema,
  shiftToggleActiveSchema,
} from "@/lib/validation/schemas/shift";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { getRequestSecurityContext } from "@/lib/security/request-context";

export type ShiftActionState = {
  error?: string;
  success?: string;
};

export async function createShiftAction(
  _prev: ShiftActionState,
  formData: FormData
): Promise<ShiftActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may manage shifts." };
  }

  const validated = safeParseWithSchema(shiftCreateSchema, {
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    graceMinutes: formData.get("graceMinutes"),
    expectedWorkMinutes: formData.get("expectedWorkMinutes"),
  });
  if (!validated.ok) return { error: validated.error };

  try {
    const shift = await prisma.shift.create({ data: validated.data });

    await writeAuditLog({
      entityType: "shift",
      entityId: String(shift.id),
      action: AUDIT_ACTIONS.SHIFT_CREATED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: validated.data,
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return { error: "A shift with this name already exists." };
    }
    throw e;
  }

  revalidatePath("/admin/shift-settings");
  return { success: "Shift created." };
}

export async function updateShiftAction(
  _prev: ShiftActionState,
  formData: FormData
): Promise<ShiftActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may manage shifts." };
  }

  const validated = safeParseWithSchema(shiftUpdateSchema, {
    id: formData.get("id"),
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    graceMinutes: formData.get("graceMinutes"),
    expectedWorkMinutes: formData.get("expectedWorkMinutes"),
  });
  if (!validated.ok) return { error: validated.error };

  const { id, ...data } = validated.data;
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) return { error: "Shift not found." };

  try {
    await prisma.shift.update({ where: { id }, data });

    await writeAuditLog({
      entityType: "shift",
      entityId: String(id),
      action: AUDIT_ACTIONS.SHIFT_UPDATED,
      actorUserId: session.id,
      actorEmail: session.email,
      oldValue: {
        name: existing.name,
        startTime: existing.startTime,
        endTime: existing.endTime,
        graceMinutes: existing.graceMinutes,
        expectedWorkMinutes: existing.expectedWorkMinutes,
      },
      newValue: data,
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return { error: "A shift with this name already exists." };
    }
    throw e;
  }

  revalidatePath("/admin/shift-settings");
  return { success: "Shift updated." };
}

export async function toggleShiftActiveAction(
  _prev: ShiftActionState,
  formData: FormData
): Promise<ShiftActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may manage shifts." };
  }

  const validated = safeParseWithSchema(shiftToggleActiveSchema, {
    id: formData.get("id"),
    isActive: formData.get("isActive"),
  });
  if (!validated.ok) return { error: validated.error };

  const { id, isActive } = validated.data;
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) return { error: "Shift not found." };

  await prisma.shift.update({ where: { id }, data: { isActive } });

  await writeAuditLog({
    entityType: "shift",
    entityId: String(id),
    action: AUDIT_ACTIONS.SHIFT_ACTIVE_TOGGLED,
    actorUserId: session.id,
    actorEmail: session.email,
    oldValue: { isActive: existing.isActive },
    newValue: { isActive },
  });

  revalidatePath("/admin/shift-settings");
  return { success: isActive ? "Shift activated." : "Shift deactivated." };
}

/** Moves every employee carrying an unrecognised Employee.shift label onto a real shift. */
export async function reassignShiftLabelAction(
  _prev: ShiftActionState,
  formData: FormData
): Promise<ShiftActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may manage shifts." };
  }

  const label = String(formData.get("label") ?? "");
  const shiftId = Number(formData.get("shiftId"));
  if (!label.trim() || !Number.isInteger(shiftId) || shiftId <= 0) {
    return { error: "Choose a shift to move these employees to." };
  }

  const target = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!target?.isActive) return { error: "That shift no longer exists or is inactive." };

  const employees = await prisma.employee.findMany({
    where: { shift: label },
    select: { id: true, employeeCode: true },
  });
  if (employees.length === 0) return { error: `No employees are on "${label}" any more.` };

  const requestContext = await getRequestSecurityContext();
  await prisma.$transaction(async (tx) => {
    await tx.employee.updateMany({
      where: { id: { in: employees.map((employee) => employee.id) } },
      data: { shift: target.name },
    });
    for (const employee of employees) {
      await writeAuditLog(
        {
          entityType: "employee",
          entityId: String(employee.id),
          action: AUDIT_ACTIONS.EMPLOYEE_UPDATED,
          actorUserId: session.id,
          actorEmail: session.email,
          employeeId: employee.id,
          module: "employees",
          description: `Shift changed from "${label}" to "${target.name}" (bulk shift clean-up).`,
          oldValue: { shift: label },
          newValue: { shift: target.name },
          requestContext,
          metadata: { operation: "shift_label_reassign", employeeCode: employee.employeeCode },
        },
        tx
      );
    }
  });

  revalidatePath("/admin/shift-settings");
  revalidatePath("/admin/employees");
  const count = `${employees.length} employee${employees.length === 1 ? "" : "s"}`;
  return { success: `Moved ${count} from "${label}" to ${target.name}.` };
}
