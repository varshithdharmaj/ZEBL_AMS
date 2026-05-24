import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "@/lib/session";

export type { SessionUser };

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { employee: true },
  });

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  if (
    user.role === "employee" &&
    user.employee &&
    (user.employee.employeeStatus !== "Active" || !user.employee.isActive)
  ) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role as "admin" | "employee",
    employeeId: user.employeeId,
    employeeName: user.employee?.name ?? null,
  };
}

export function getDefaultRedirect(role: "admin" | "employee"): string {
  return role === "admin" ? "/admin/dashboard" : "/employee/dashboard";
}

export { createSessionToken };
