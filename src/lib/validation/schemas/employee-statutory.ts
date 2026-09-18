import { z } from "zod";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_REGEX = /^\d{12}$/;
const UAN_REGEX = /^\d{12}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACCOUNT_REGEX = /^\d{6,20}$/;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

const optionalPattern = (regex: RegExp, message: string, normalize: (value: string) => string = (v) => v) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalize(value) : null))
    .refine((value) => value === null || regex.test(value), { message });

export const employeeStatutoryDetailSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  pan: optionalPattern(PAN_REGEX, "Enter a valid PAN (e.g. ABCDE1234F).", (v) => v.toUpperCase()),
  aadhaar: optionalPattern(AADHAAR_REGEX, "Aadhaar must be 12 digits.", (v) => v.replace(/\s+/g, "")),
  uan: optionalPattern(UAN_REGEX, "UAN must be 12 digits.", (v) => v.replace(/\s+/g, "")),
  pfNumber: optionalText(50),
  esiNumber: optionalText(50),
  bankAccountNo: optionalPattern(BANK_ACCOUNT_REGEX, "Bank account number must be 6-20 digits."),
  ifsc: optionalPattern(IFSC_REGEX, "Enter a valid IFSC code (e.g. HDFC0001234).", (v) => v.toUpperCase()),
  bankName: optionalText(150),
});

export type EmployeeStatutoryDetailInput = z.infer<typeof employeeStatutoryDetailSchema>;
