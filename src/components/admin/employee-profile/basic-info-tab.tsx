"use client";

import { useActionState, useState } from "react";
import { updateEmployeeProfileAction, type ActionState } from "@/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { EMPLOYEE_STATUSES } from "@/lib/employee-types";
import type { ProfileEmployee } from "@/components/admin/employee-profile/profile-shell";

const initialState: ActionState = {};

export function BasicInfoTab({ employee }: { employee: ProfileEmployee }) {
  const [state, formAction, pending] = useActionState(updateEmployeeProfileAction, initialState);
  const [status, setStatus] = useState(employee.employeeStatus);

  return (
    <SectionCard title="Basic information" description="Employee profile details">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="id" value={employee.id} />
        <input type="hidden" name="employeeStatus" value={status} />
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {state.success}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="employeeCode">Employee code</Label>
            <Input id="employeeCode" name="employeeCode" defaultValue={employee.employeeCode} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" defaultValue={employee.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={employee.phone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={employee.department ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" name="designation" defaultValue={employee.designation ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift">Shift</Label>
            <Input id="shift" name="shift" defaultValue={employee.shift ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="joiningDate">Joining date</Label>
            <Input
              id="joiningDate"
              name="joiningDate"
              type="date"
              defaultValue={new Date(employee.joiningDate).toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {employee.user && (
          <p className="text-sm text-muted-foreground">
            Login: <span className="font-medium text-foreground">{employee.user.email}</span>
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </SectionCard>
  );
}
