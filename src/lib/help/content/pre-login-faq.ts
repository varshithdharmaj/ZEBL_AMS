/**
 * Narrow, public-safe FAQ shown on the login page before authentication —
 * deliberately separate from the full role-scoped guides under /admin/help
 * and /employee/help, which reference internal routes and shouldn't be
 * reachable pre-login.
 */
export type PreLoginFaqItem = {
  question: string;
  answer: string;
};

export const PRE_LOGIN_FAQ: PreLoginFaqItem[] = [
  {
    question: "It's my first time signing in — what do I do?",
    answer:
      "Sign in with the work email and temporary password HR gave you. You'll be asked to set your own password before you can do anything else — this step can't be skipped.",
  },
  {
    question: "I forgot my password. How do I reset it?",
    answer:
      "There's no self-service reset yet — ask HR to reset it for you. Once they do, you'll set a new password the next time you sign in.",
  },
  {
    question: "It says my account is locked or inactive — what does that mean?",
    answer:
      "HR can lock or deactivate an account — usually after repeated failed sign-ins, or when someone leaves the organization. If you believe this is a mistake, contact HR directly to have it reviewed and unlocked.",
  },
  {
    question: "I don't have an account yet — who do I contact?",
    answer: "Accounts are created by HR. Reach out to your HR team directly to get one provisioned.",
  },
];
