"use server";

import { redirect } from "next/navigation";
import {
  authenticateUser,
  clearSessionCookie,
  getDefaultRedirect,
  setSessionCookie,
} from "@/lib/auth";
import { createSessionToken } from "@/lib/session";

export type AuthState = {
  error?: string;
};

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    return { error: "Invalid email or password." };
  }

  const token = await createSessionToken(user);
  await setSessionCookie(token);
  redirect(getDefaultRedirect(user.role));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
