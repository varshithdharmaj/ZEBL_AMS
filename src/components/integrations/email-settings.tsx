"use client";

import { useActionState } from "react";
import {
  updateEmailSettingsAction,
  sendTestEmailAction,
  type IntegrationActionState,
} from "@/actions/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import type { IntegrationSettings } from "@/generated/prisma/client";

const initial: IntegrationActionState = {};

export function EmailSettingsForm({ settings }: { settings: IntegrationSettings }) {
  const [state, formAction, pending] = useActionState(updateEmailSettingsAction, initial);
  const [testState, testAction, testPending] = useActionState(sendTestEmailAction, initial);

  return (
    <SectionCard
      title="Email (SMTP)"
      description="Sender account used to email candidates and staff — offer letters, notifications, approvals."
    >
      <form action={formAction} className="space-y-4">
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {state.success}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">SMTP host</Label>
            <Input
              id="smtpHost"
              name="smtpHost"
              defaultValue={settings.smtpHost ?? ""}
              placeholder="smtp.office365.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpPort">SMTP port</Label>
            <Input
              id="smtpPort"
              name="smtpPort"
              type="number"
              defaultValue={settings.smtpPort ?? 587}
              placeholder="587"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpUser">SMTP username / login</Label>
            <Input
              id="smtpUser"
              name="smtpUser"
              defaultValue={settings.smtpUser ?? ""}
              placeholder="offers@yourcompany.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpPassword">SMTP password</Label>
            <Input
              id="smtpPassword"
              name="smtpPassword"
              type="password"
              placeholder={settings.smtpPassword ? "•••••••• (unchanged)" : "App password"}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="smtpFromAddress">From address</Label>
            <Input
              id="smtpFromAddress"
              name="smtpFromAddress"
              defaultValue={settings.smtpFromAddress ?? ""}
              placeholder="HR Team <offers@yourcompany.com>"
            />
          </div>
        </div>

        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : "Save email settings"}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-4">
        <form action={testAction} className="flex flex-wrap items-end gap-3">
          {testState.error && <ErrorAlert message={testState.error} />}
          {testState.success && (
            <p className="w-full rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
              {testState.success}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="testRecipient">Send a test email to</Label>
            <Input
              id="testRecipient"
              name="testRecipient"
              type="email"
              placeholder="you@yourcompany.com"
              className="w-64"
            />
          </div>
          <Button type="submit" variant="outline" loading={testPending}>
            {testPending ? "Sending…" : "Send test email"}
          </Button>
        </form>
        {settings.smtpLastTestAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last test: {new Date(settings.smtpLastTestAt).toLocaleString()} —{" "}
            {settings.smtpLastTestStatus}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
