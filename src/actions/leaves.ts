"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  countLeaveDays,
  deductLeaveForApproval,
  getLeaveBalanceSummaries,
  processPendingLeaveAccruals,
} from "@/lib/leave";
import { isValidLeaveType } from "@/lib/leave-types";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function applyLeaveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "employee" || !session.employeeId) {
    return { error: "Unauthorized." };
  }

  const leaveType = String(formData.get("leaveType") ?? "").trim();
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!isValidLeaveType(leaveType)) {
    return { error: "Please select a valid leave type (EL, CL, or SL)." };
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "Valid dates are required." };
  }

  if (endDate < startDate) {
    return { error: "End date cannot be before start date." };
  }

  if (!reason) {
    return { error: "Reason is required." };
  }

  const days = countLeaveDays(startDate, endDate);

  try {
    await processPendingLeaveAccruals(session.employeeId);
    const balances = await getLeaveBalanceSummaries(session.employeeId);
    const typeBalance = balances.find((b) => b.leaveType === leaveType);

    if (leaveType === "EL" && !typeBalance?.eligible) {
      return { error: "You are not yet eligible for Earned Leave (requires 1 year of service)." };
    }

    if ((typeBalance?.remaining ?? 0) < days) {
      return {
        error: `Insufficient ${leaveType} balance. Available: ${typeBalance?.remaining ?? 0}, requested: ${days}.`,
      };
    }

    await prisma.leaveRequest.create({
      data: {
        employeeId: session.employeeId,
        leaveType,
        startDate,
        endDate,
        days,
        reason,
        status: "pending",
      },
    });

    revalidatePath("/employee/leaves");
    revalidatePath("/admin/leaves");
    return { success: "Leave request submitted." };
  } catch {
    return { error: "Failed to submit leave request." };
  }
}

export async function reviewLeaveFormAction(formData: FormData): Promise<void> {
  const leaveId = parseInt(String(formData.get("leaveId")), 10);
  const status = String(formData.get("status")) as "approved" | "rejected";
  if (leaveId && (status === "approved" || status === "rejected")) {
    await reviewLeaveAction(leaveId, status);
  }
}

export async function reviewLeaveAction(
  leaveId: number,
  status: "approved" | "rejected"
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { error: "Unauthorized." };
  }

  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { employee: true },
    });

    if (!leave) return { error: "Leave request not found." };
    if (leave.status !== "pending") {
      return { error: "This request has already been processed." };
    }

    if (status === "approved") {
      const days = leave.days > 0 ? leave.days : countLeaveDays(leave.startDate, leave.endDate);

      if (!isValidLeaveType(leave.leaveType)) {
        return { error: "Invalid leave type on request." };
      }

      await deductLeaveForApproval({
        employeeId: leave.employeeId,
        leaveType: leave.leaveType,
        days,
        leaveRequestId: leave.id,
        createdBy: session.email,
      });

      await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: "approved",
          days,
          reviewedBy: session.email,
          reviewedAt: new Date(),
        },
      });
    } else {
      await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: "rejected",
          reviewedBy: session.email,
          reviewedAt: new Date(),
        },
      });
    }

    revalidatePath("/admin/leaves");
    revalidatePath(`/admin/employees/${leave.employeeId}`);
    revalidatePath("/employee/leaves");
    return { success: `Leave request ${status}.` };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update leave request.";
    return { error: message };
  }
}
