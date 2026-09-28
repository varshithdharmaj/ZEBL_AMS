"use client";

import { useActionState } from "react";
import { updateOwnContactInfoAction, type ActionState } from "@/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";

const initialState: ActionState = {};

export function ContactInfoForm({
  phone,
  alternatePhone,
  address,
  emergencyContact,
}: {
  phone: string | null;
  alternatePhone: string | null;
  address: string | null;
  emergencyContact: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateOwnContactInfoAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <ErrorAlert message={state.error} />}
      {state.success && (
        <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
          {state.success}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={phone ?? ""} autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alternatePhone">Alternate phone</Label>
          <Input id="alternatePhone" name="alternatePhone" defaultValue={alternatePhone ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={address ?? ""} autoComplete="street-address" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="emergencyContact">Emergency contact</Label>
          <Input
            id="emergencyContact"
            name="emergencyContact"
            defaultValue={emergencyContact ?? ""}
            placeholder="Name and phone number"
          />
        </div>
      </div>
      <Button type="submit" size="sm" loading={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
