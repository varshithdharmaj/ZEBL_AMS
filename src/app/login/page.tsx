import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
          Z
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Zebl Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
      </div>
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
