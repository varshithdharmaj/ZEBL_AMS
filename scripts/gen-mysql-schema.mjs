// One-off generator: transforms prisma/schema.prisma into prisma-mysql/schema.prisma.
// Not wired into any build step — rerun manually after editing prisma/schema.prisma
// and re-apply the Phase 2 manual edits (OfferNumberSeq, virtual-column fields) by hand.
import fs from "node:fs";

const SRC = "prisma/schema.prisma";
const OUT = "prisma-mysql/schema.prisma";

const src = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const lines = src.split("\n");

const out = [];
let inDatasource = false;
let inGeneratorClient = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // --- datasource block -----------------------------------------------------
  if (/^datasource db \{/.test(line)) {
    out.push(
      "datasource db {",
      '  provider = "mysql"',
      '  url      = env("DATABASE_MYSQL_URL")',
      "}"
    );
    inDatasource = true;
    continue;
  }
  if (inDatasource) {
    if (line.trim() === "}") inDatasource = false;
    continue;
  }

  // --- generator client block ------------------------------------------------
  if (/^generator client \{/.test(line)) {
    inGeneratorClient = true;
    out.push(line);
    continue;
  }
  if (inGeneratorClient) {
    if (line.trim() === "}") {
      inGeneratorClient = false;
      out.push(line);
      continue;
    }
    if (/^\s*output\s*=/.test(line)) {
      out.push('  output        = "../src/generated/prisma-mysql"');
      continue;
    }
    out.push(line);
    continue;
  }

  // --- field-line transforms --------------------------------------------------
  // Only scalar field declarations look like: `  name   Type[?]   attrs...`
  const fieldMatch = line.match(/^(\s*)([A-Za-z][A-Za-z0-9]*)(\s+)(\S+)(\s*)(.*)$/);
  if (fieldMatch) {
    const [, indent, name, gap1, type, gap2, rest] = fieldMatch;

    // DateTime scalar fields -> explicit @db.DateTime(3) native type.
    if ((type === "DateTime" || type === "DateTime?") && !rest.includes("@db.")) {
      line = `${indent}${name}${gap1}${type}${gap2}@db.DateTime(3) ${rest}`.trimEnd();
    }

    // String @id @default(cuid()) primary keys -> @db.VarChar(30).
    else if (
      (type === "String" || type === "String?") &&
      /@id\b/.test(rest) &&
      !rest.includes("@db.")
    ) {
      line = `${indent}${name}${gap1}${type}${gap2}${rest} @db.VarChar(30)`.trimEnd();
    }

    // String foreign-key columns (camelCase name ending in "Id") -> @db.VarChar(30)
    // so FK column definitions line up with the VarChar(30) cuid PKs above.
    else if ((type === "String" || type === "String?") && /Id$/.test(name) && !rest.includes("@db.")) {
      line = `${indent}${name}${gap1}${type}${gap2}${rest} @db.VarChar(30)`.trimEnd();
    }

    // String columns holding serialized JSON (@default("{}") / @default("[]"))
    // -> @db.Text so they aren't silently capped at MySQL's default VARCHAR(191).
    else if (
      (type === "String" || type === "String?") &&
      /@default\("(\{\}|\[\])"\)/.test(rest) &&
      !rest.includes("@db.")
    ) {
      line = `${indent}${name}${gap1}${type}${gap2}${rest} @db.Text`.trimEnd();
    }
  }

  out.push(line);
}

let result = out.join("\n");

// Header banner.
result =
  `// AUTO-GENERATED from prisma/schema.prisma by scripts/gen-mysql-schema.mjs.\n` +
  `// Mechanical PostgreSQL -> MySQL attribute conversion; hand-authored additions\n` +
  `// (OfferNumberSeq, virtual-column placeholder fields, @@unique on leave_transactions)\n` +
  `// are applied on top and must be re-applied if this file is regenerated.\n` +
  `// See prisma-mysql/README.md for the full picture — this file is\n` +
  `// intentionally isolated from prisma/schema.prisma (PostgreSQL, source of truth).\n\n` +
  result;

fs.mkdirSync("prisma-mysql", { recursive: true });
fs.writeFileSync(OUT, result);
console.log(`Wrote ${OUT} (${result.split("\n").length} lines)`);
