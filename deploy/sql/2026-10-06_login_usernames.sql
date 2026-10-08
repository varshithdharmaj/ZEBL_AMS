-- Login usernames: give every login that is linked to an employee the employee
-- code as its username (e.g. 660052), so staff sign in with that number.
-- Run once on the production database in pgAdmin, AFTER deploying the code that
-- lets people sign in with a username.
--
-- Safe to run more than once. Only fills usernames that are empty today; never
-- changes a username HR already set. Skips codes that can't be a username or
-- that another login already uses. Emails and passwords are not touched.
-- Logins that still sign in with their email after this still work.

BEGIN;

UPDATE "users" u
SET "username" = e."employee_code",
    "updatedAt" = NOW()
FROM "employees" e
WHERE u."employeeId" = e."id"
  AND u."username" IS NULL
  AND e."employee_code" ~ '^[A-Za-z0-9._-]{3,100}$'
  AND NOT EXISTS (
    SELECT 1 FROM "users" other
    WHERE other."id" <> u."id"
      AND LOWER(other."username") = LOWER(e."employee_code")
  );

-- Check: logins linked to an employee that still have no username.
SELECT u."email", e."employee_code"
FROM "users" u
JOIN "employees" e ON e."id" = u."employeeId"
WHERE u."username" IS NULL;

COMMIT;
