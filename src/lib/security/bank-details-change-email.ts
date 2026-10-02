import { getTransporter } from "@/lib/notifications/channels/email-channel";
import { getEmployeeUserEmail } from "@/lib/notifications/recipient-resolver";
import { maskBankAccount } from "@/lib/security/field-masking";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tells an employee their salary bank account was changed, so a change they didn't ask
 * for (e.g. someone impersonating them in an email to HR) is noticed before payroll runs.
 * Sent directly like the offer letter email: the notification queue has no matching
 * NotificationType and adding one needs a migration. Returns whether it was sent; never throws.
 */
export async function sendBankDetailsChangedEmail(input: {
  employeeId: number;
  bankAccountNo: string;
  ifsc: string | null;
  changedByEmail: string;
}): Promise<boolean> {
  try {
    const transport = getTransporter();
    if (!transport) return false;
    const recipient = await getEmployeeUserEmail(input.employeeId);
    if (!recipient) return false;

    const account = maskBankAccount(input.bankAccountNo);
    const when = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const lines = [
      `Hi ${recipient.name ?? "there"},`,
      `The bank account used for your salary was changed in ZEBL HRMS on ${when} by ${input.changedByEmail}.`,
      `New account: ${input.ifsc ? `${account} (IFSC ${input.ifsc})` : account}`,
      "If you asked for this change, you don't need to do anything. If you didn't, contact HR right away so your salary isn't paid into the wrong account.",
      "ZEBL HRMS",
    ];

    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "HRMS <noreply@zebl.local>",
      to: recipient.email,
      subject: "Your salary bank account was changed",
      text: lines.join("\n\n"),
      html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
    });
    return true;
  } catch (error) {
    console.error(
      "[bank-details-change-email] send failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
