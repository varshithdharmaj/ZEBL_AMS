"use server";

import { revalidatePath } from "next/cache";
import {
  createHistoricalLeaveEntry,
  editHistoricalLeaveEntry,
  HistoricalLeaveEntryError,
} from "@/lib/leave/historical-entry";
import { getLeavePolicySettings } from "@/lib/leave/leave-policy";
import { toWorkflowActor } from "@/lib/workflow/leave-workflow";
import { isValidLeaveType } from "@/lib/leave-types";
import { requireAdminSession } from "@/lib/auth-guards";

export type ActionState = {
  error?: string;
  success?: string;
};

function revalidateLeavePaths(employeeId: number) {
  revalidatePath("/admin/leaves");
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/employee/leaves");
  revalidatePath("/employee/dashboard");
  revalidatePath("/employee/profile");
}

function parseHistoricalEntryForm(formData: FormData) {
  const employeeId = parseInt(String(formData.get("employeeId")), 10);
  const leaveType = String(formData.get("leaveType") ?? "").trim();
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));
  const reason = String(formData.get("reason") ?? "").trim();
  return { employeeId, leaveType, startDate, endDate, reason };
}

export async function addHistoricalLeaveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireAdminSession();

    const { allowHistoricalLeaveEntry } = await getLeavePolicySettings();
    if (!allowHistoricalLeaveEntry) {
      return { error: "Adding historical leave entries is disabled. Enable it from Leave Settings first." };
    }

    const { employeeId, leaveType, startDate, endDate, reason } = parseHistoricalEntryForm(formData);
    if (!employeeId || !isValidLeaveType(leaveType)) {
      return { error: "Invalid employee or leave type." };
    }

    const result = await createHistoricalLeaveEntry({
      employeeId,
      leaveType,
      startDate,
      endDate,
      reason,
      actor: toWorkflowActor(session),
    });

    revalidateLeavePaths(employeeId);
    return {
      success:
        result.lopDays > 0
          ? `Historical leave added (${result.days} day(s), ${result.lopDays} recorded as LOP — balance was insufficient).`
          : `Historical leave added (${result.days} day(s)).`,
    };
  } catch (e) {
    const message = e instanceof HistoricalLeaveEntryError ? e.message : "Failed to add historical leave.";
    return { error: message };
  }
}

export async function editHistoricalLeaveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireAdminSession();

    const { allowHistoricalLeaveEdit } = await getLeavePolicySettings();
    if (!allowHistoricalLeaveEdit) {
      return { error: "Correcting historical leave entries is disabled. Enable it from Leave Settings first." };
    }

    const leaveRequestId = parseInt(String(formData.get("leaveRequestId")), 10);
    const { employeeId, leaveType, startDate, endDate, reason } = parseHistoricalEntryForm(formData);
    if (!leaveRequestId || !employeeId || !isValidLeaveType(leaveType)) {
      return { error: "Invalid entry, employee, or leave type." };
    }

    const result = await editHistoricalLeaveEntry({
      leaveRequestId,
      employeeId,
      leaveType,
      startDate,
      endDate,
      reason,
      actor: toWorkflowActor(session),
    });

    revalidateLeavePaths(employeeId);
    return {
      success:
        result.lopDays > 0
          ? `Entry corrected (${result.days} day(s), ${result.lopDays} recorded as LOP — balance was insufficient).`
          : `Entry corrected (${result.days} day(s)).`,
    };
  } catch (e) {
    const message = e instanceof HistoricalLeaveEntryError ? e.message : "Failed to correct historical leave entry.";
    return { error: message };
  }
}
