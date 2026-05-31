import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth/cookies";

/** Clears session cookie before login redirect to avoid ERR_TOO_MANY_REDIRECTS. */
export async function redirectToLogin(): Promise<never> {
  await clearSessionCookie();
  redirect("/login");
}
