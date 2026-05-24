import { SignJWT, jwtVerify } from "jose";

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "employee";
  employeeId: number | null;
  employeeName: string | null;
};

const COOKIE_NAME = "zebl_session";

export { COOKIE_NAME };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    employeeName: user.employeeName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as "admin" | "employee",
      employeeId: (payload.employeeId as number | null) ?? null,
      employeeName: (payload.employeeName as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
