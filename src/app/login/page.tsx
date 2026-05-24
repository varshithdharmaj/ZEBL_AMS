import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary-muted via-background to-sky-muted/40 px-4">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-elevated">
          Z
        </div>
        <h1 className="bg-gradient-to-r from-primary to-violet bg-clip-text text-xl font-semibold tracking-tight text-transparent">
          Zebl Attendance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
      </div>
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
