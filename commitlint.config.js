/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Matches scopes already in use across the history (recruitment, leave,
    // attendance, auth, db, ops, server, ui, dashboard, workflow, cloudflare, ...)
    // without hard-coding an enum that would need updating for every new module.
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [0],
  },
};
