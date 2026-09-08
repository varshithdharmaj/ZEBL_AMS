import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { NotificationChannel, NotificationType } from "@/generated/prisma/enums";
import { renderNotificationEmail } from "@/emails/render-email";
import {
  parseNotificationPayload,
  type ChannelDeliveryResult,
  type NotificationChannelHandler,
} from "@/lib/notifications/notification-types";

let transporter: Transporter | null = null;

/** Shared SMTP transport — reused by the notification channel and by direct-send paths (e.g. offer letters). */
export function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return transporter;
}

export class EmailNotificationChannel implements NotificationChannelHandler {
  readonly channel = NotificationChannel.email;

  async send(notification: {
    id: string;
    type: NotificationType;
    recipient: string;
    subject: string;
    payload: string;
  }): Promise<ChannelDeliveryResult> {
    const transport = getTransporter();
    if (!transport) {
      // Never fabricate a "sent" result — an unconfigured SMTP_HOST means the email
      // was NOT delivered, in dev or prod alike. Returning failure here routes through
      // the normal markNotificationFailed path (notification-queue.ts), so the queue
      // row's status/lastError/attempts honestly reflect what happened instead of
      // masking it behind a fake success.
      console.warn(
        `[EmailChannel] SMTP_HOST not configured. Notification email skipped/queued.`,
        { recipient: notification.recipient, subject: notification.subject, type: notification.type }
      );
      return {
        success: false,
        error: "SMTP_HOST is not configured — email skipped (not delivered)",
      };
    }

    try {
      const data = parseNotificationPayload(notification.payload);
      const { html, text } = await renderNotificationEmail(notification.type, data);

      const from = process.env.EMAIL_FROM ?? "HRMS <noreply@zebl.local>";
      const result = await transport.sendMail({
        from,
        to: notification.recipient,
        subject: notification.subject,
        html,
        text,
      });

      return {
        success: true,
        providerMessageId: result.messageId,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Email send failed";
      return { success: false, error: message };
    }
  }
}

export const emailChannel = new EmailNotificationChannel();
