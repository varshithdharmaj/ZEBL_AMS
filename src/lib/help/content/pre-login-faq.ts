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
    question: "It's my first time signing in. What do I do?",
    answer:
      "Sign in with the username and temporary password HR gave you. You'll then need to set your own password before you can continue.",
  },
  {
    question: "I forgot my password. How do I reset it?",
    answer:
      "Ask HR to reset it. You can't reset it yourself yet. You'll set a new password the next time you sign in.",
  },
  {
    question: "It says my account is locked or inactive. What does that mean?",
    answer:
      "HR can lock or turn off an account, usually after too many wrong passwords or when someone leaves the company. If you think it's a mistake, contact HR and ask them to unlock it.",
  },
  {
    question: "I don't have an account yet. Who do I contact?",
    answer: "HR creates accounts. Ask your HR team to set one up for you.",
  },
];
