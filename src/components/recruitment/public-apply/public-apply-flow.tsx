"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, ImageIcon, Loader2, Pencil, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorAlert } from "@/components/ui/error-alert";
import { cn } from "@/lib/utils";
import { publicBasicInfoSchema } from "@/lib/validation/schemas/recruitment/public-apply";
import {
  companyIsBlank,
  experienceHasProblems,
  flattenCompanies,
  groupExperiences,
  monthsToYears,
  totalExperienceMonths,
  type CompanyEntry,
  type ExperienceRow,
} from "@/lib/recruitment/public-apply/experience-entries";
import { ExperienceEditor, ExperienceSummary } from "@/components/recruitment/public-apply/experience-editor";

type ReviewPersonal = {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
};

type ReviewProfessional = {
  headline: string | null;
  professionalSummary: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  totalExperienceYears: string | null;
  preferredWorkMode: string | null;
  willingToRelocate: boolean | null;
};

type ReviewCompensation = {
  currentCtc: string | null;
  noticePeriodDays: number | null;
};

type EducationRow = { institution: string; degree?: string | null; field?: string | null };
type SkillRow = { name: string; proficiency?: string | null };
type ProjectRow = { title: string; summary?: string | null };
type CertificationRow = { name: string; issuer?: string | null };

type ReviewPayload = {
  personal: ReviewPersonal;
  professional: ReviewProfessional;
  compensation: ReviewCompensation;
  experiences: ExperienceRow[];
  educations: EducationRow[];
  skills: SkillRow[];
  projects: ProjectRow[];
  certifications: CertificationRow[];
};

type Mode = "form" | "preview" | "success";

type ResumeState =
  | { status: "empty" }
  /** Picked before name/email/phone were valid — the server needs those first. */
  | { status: "waiting"; file: File }
  | { status: "reading"; file: File }
  | { status: "read"; file: File }
  /** Uploaded, but the parser couldn't extract anything — candidate fills in by hand. */
  | { status: "unreadable"; file: File; note: string }
  | { status: "failed"; file: File; message: string };

type FieldKey =
  | "fullName"
  | "email"
  | "phone"
  | "resume"
  | "photo"
  | "currentTitle"
  | "currentCtc"
  | "noticePeriodDays"
  | "totalExperienceYears"
  | "professionalSummary"
  | "experiences"
  | "educations";
type FieldErrors = Partial<Record<FieldKey, string>>;

/** Page order — the first failing field is the one scrolled into view. */
const FIELD_ORDER: FieldKey[] = [
  "fullName",
  "email",
  "phone",
  "resume",
  "photo",
  "currentTitle",
  "currentCtc",
  "noticePeriodDays",
  "totalExperienceYears",
  "professionalSummary",
  "experiences",
  "educations",
];

/**
 * The server-side submission behind the form. The server never re-parses a
 * resume into a submission that's already been parsed or edited (design §9),
 * so swapping the resume after that starts a fresh session; the old one just
 * expires.
 */
type Session = { token: string; acceptsResume: boolean; uploadedPhoto: File | null };

const TOP_ID = "apply-top";
const SECTION = {
  details: "apply-section-details",
  documents: "apply-section-documents",
  professional: "apply-section-professional",
  background: "apply-section-background",
} as const;

const RESUME_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const CTC_PATTERN = /^\d+(\.\d{1,2})?$/;

const EMPTY_FORM: ReviewPayload = {
  personal: { fullName: "", firstName: null, lastName: null, email: "", phone: "", location: "" },
  professional: {
    headline: null,
    professionalSummary: null,
    currentCompany: null,
    currentTitle: null,
    githubUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    totalExperienceYears: null,
    preferredWorkMode: null,
    willingToRelocate: null,
  },
  compensation: { currentCtc: null, noticePeriodDays: null },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
  certifications: [],
};

function apiBase(token: string): string {
  return `/api/public/applications/${encodeURIComponent(token)}`;
}

async function callApi<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && (body as { error?: { message?: string } }).error?.message) ||
      "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return body as T;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

const isBlank = (value: string | null | undefined) => !value || !value.trim();

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The server accepts digits with an optional leading "+" — drop the spaces,
 * dashes and brackets people (and resumes) naturally write. */
function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, "");
}

function basicInfoReady(personal: ReviewPersonal): boolean {
  return publicBasicInfoSchema.safeParse({
    fullName: personal.fullName,
    email: personal.email ?? "",
    phone: normalizePhone(personal.phone ?? ""),
  }).success;
}

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

function resumeFileProblem(file: File): string | null {
  if (!["pdf", "docx"].includes(extensionOf(file.name))) return "Please choose a PDF or Word (.docx) file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > RESUME_MAX_BYTES) return "That file is over 10 MB. Please choose a smaller one.";
  return null;
}

function photoFileProblem(file: File): string | null {
  if (!["jpg", "jpeg", "png", "webp"].includes(extensionOf(file.name))) return "Please choose a JPEG, PNG or WebP image.";
  if (file.size === 0) return "That image is empty.";
  if (file.size > PHOTO_MAX_BYTES) return "That image is over 5 MB. Please choose a smaller one.";
  return null;
}

const hasEducation = (rows: EducationRow[]) => rows.some((r) => !isBlank(r.institution) || !isBlank(r.degree));
const hasSkills = (rows: SkillRow[]) => rows.some((r) => !isBlank(r.name));

/**
 * Merge what the parser read from the resume into the form without ever
 * overwriting something the candidate typed: visible fields and lists are
 * only filled when blank. Fields the form doesn't show (headline, GitHub,
 * projects, …) always follow the latest resume.
 */
function fillFromResume(current: ReviewPayload, parsed: ReviewPayload): ReviewPayload {
  const pick = (mine: string | null, theirs: string | null | undefined) => (isBlank(mine) ? (theirs ?? mine) : mine);
  return {
    personal: {
      ...parsed.personal,
      fullName: pick(current.personal.fullName, parsed.personal.fullName) ?? "",
      email: pick(current.personal.email, parsed.personal.email),
      phone: pick(current.personal.phone, parsed.personal.phone),
      location: pick(current.personal.location, parsed.personal.location),
    },
    professional: {
      ...parsed.professional,
      currentTitle: pick(current.professional.currentTitle, parsed.professional.currentTitle),
      currentCompany: pick(current.professional.currentCompany, parsed.professional.currentCompany),
      professionalSummary: pick(current.professional.professionalSummary, parsed.professional.professionalSummary),
      totalExperienceYears: pick(current.professional.totalExperienceYears, parsed.professional.totalExperienceYears),
      linkedinUrl: pick(current.professional.linkedinUrl, parsed.professional.linkedinUrl),
    },
    // Never parsed from a resume — always candidate-entered.
    compensation: current.compensation,
    // Edited as companies → roles in separate state (see groupExperiences); rebuilt on preview.
    experiences: current.experiences,
    educations: hasEducation(current.educations) ? current.educations : parsed.educations,
    skills: hasSkills(current.skills) ? current.skills : parsed.skills,
    projects: parsed.projects,
    certifications: parsed.certifications,
  };
}

/** Client-side checks with friendly copy, plus the cleaned payload sent to the server. */
function validateForm(
  form: ReviewPayload,
  companies: CompanyEntry[],
  resume: ResumeState,
  photo: File | null
): { errors: FieldErrors; payload: ReviewPayload; companies: CompanyEntry[] } {
  const errors: FieldErrors = {};

  const personal: ReviewPersonal = {
    ...form.personal,
    fullName: form.personal.fullName.trim(),
    email: (form.personal.email ?? "").trim(),
    phone: normalizePhone(form.personal.phone ?? ""),
    location: trimToNull(form.personal.location),
  };
  if (personal.fullName.length < 2) errors.fullName = "Enter your full name.";
  if (!personal.email) errors.email = "Enter your email address.";
  else if (!publicBasicInfoSchema.shape.email.safeParse(personal.email).success)
    errors.email = "Enter a valid email address.";
  if (!personal.phone) errors.phone = "Enter your phone number.";
  else if (!publicBasicInfoSchema.shape.phone.safeParse(personal.phone).success)
    errors.phone = "Enter a valid phone number, using digits only. Spaces and a + country code are fine.";

  switch (resume.status) {
    case "empty":
      errors.resume = "Upload your resume.";
      break;
    case "waiting":
      errors.resume = "We'll read your resume once your name, email and phone are filled in.";
      break;
    case "reading":
      errors.resume = "We're still reading your resume. Give it a moment.";
      break;
    case "failed":
      errors.resume = resume.message;
      break;
  }
  if (!photo) errors.photo = "Add a passport-size photo.";

  // Mandatory for every candidate; freshers answer "Fresher" / 0 / 0.
  const currentTitle = trimToNull(form.professional.currentTitle);
  if (!currentTitle) errors.currentTitle = "Enter your current position, or “Fresher”.";
  const currentCtc = (form.compensation.currentCtc ?? "").replace(/[,\s]/g, "");
  if (!currentCtc) errors.currentCtc = "Enter your current CTC (0 if you're a fresher).";
  else if (!CTC_PATTERN.test(currentCtc)) errors.currentCtc = "Use numbers only, without ₹ or words like lakh or LPA. Commas are fine.";
  const notice = form.compensation.noticePeriodDays;
  if (notice === null) errors.noticePeriodDays = "Enter your notice period in days (0 if you can join immediately).";
  else if (!Number.isInteger(notice) || notice < 0 || notice > 365)
    errors.noticePeriodDays = "Enter a number of days between 0 and 365.";

  const totalExperienceYears = trimToNull(form.professional.totalExperienceYears);
  if (totalExperienceYears && totalExperienceYears.length > 10)
    errors.totalExperienceYears = "Enter the number of years, using digits only.";
  const professionalSummary = trimToNull(form.professional.professionalSummary);
  if (professionalSummary && professionalSummary.length > 4000)
    errors.professionalSummary = "Please keep the summary under 4,000 characters.";

  const filledCompanies = companies.filter((company) => !companyIsBlank(company));
  if (experienceHasProblems(filledCompanies, new Date()))
    errors.experiences = "Please complete the highlighted experience details.";

  const educations = form.educations
    .map((row) => ({ ...row, institution: row.institution.trim(), degree: trimToNull(row.degree) }))
    .filter((row) => row.institution || row.degree);
  if (educations.some((row) => !row.institution))
    errors.educations = "Add the institution for each entry, or remove it.";

  const skills = form.skills.map((row) => ({ ...row, name: row.name.trim() })).filter((row) => row.name);

  return {
    errors,
    payload: {
      ...form,
      personal,
      professional: {
        ...form.professional,
        currentTitle,
        currentCompany: trimToNull(form.professional.currentCompany),
        linkedinUrl: trimToNull(form.professional.linkedinUrl),
        totalExperienceYears,
        professionalSummary,
      },
      compensation: { currentCtc: currentCtc || null, noticePeriodDays: notice },
      experiences: flattenCompanies(filledCompanies),
      educations,
      skills,
    },
    companies: filledCompanies,
  };
}

function parseFailureCopy(reason?: string): string {
  switch (reason) {
    case "EMPTY_DOCUMENT":
      return "We couldn't find selectable text in this file (it may be a scanned image). Please fill in your details below.";
    case "UNSUPPORTED_TYPE":
      return "We couldn't read this file. Please fill in your details below.";
    case "CORRUPTED_FILE":
    case "EXTRACTION_FAILED":
      return "This file looks damaged. Please fill in your details below.";
    default:
      return "We couldn't automatically read your resume. Please fill in your details below.";
  }
}

function formatCtc(value: string | null): string | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)} per year`;
}

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function PublicApplyFlow({ jobPublicSlug, jobTitle }: { jobPublicSlug: string; jobTitle: string }) {
  const [mode, setMode] = useState<Mode>("form");
  const [form, setForm] = useState<ReviewPayload>(EMPTY_FORM);
  const [companies, setCompanies] = useState<CompanyEntry[]>([]);
  const [resume, setResume] = useState<ResumeState>({ status: "empty" });
  const [photo, setPhoto] = useState<File | null>(null);
  const photoUrl = useObjectUrl(photo);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  // Honeypot — real candidates never see or fill this field.
  const [website, setWebsite] = useState("");
  const formRenderedAtRef = useRef(Date.now());
  const sessionRef = useRef<Session | null>(null);

  // Scroll once the target exists — after a mode switch it only renders next pass.
  useEffect(() => {
    if (!scrollTarget) return;
    const el = document.getElementById(scrollTarget);
    if (el) {
      const isSection = el.tagName === "SECTION" || scrollTarget === TOP_ID;
      el.scrollIntoView({ behavior: "smooth", block: isSection ? "start" : "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
    }
    setScrollTarget(null);
  }, [scrollTarget]);

  // Nothing survives a reload (files can't be restored), so warn before leaving mid-application.
  const hasProgress =
    mode !== "success" &&
    (resume.status !== "empty" ||
      photo !== null ||
      companies.length > 0 ||
      !isBlank(form.personal.fullName) ||
      !isBlank(form.personal.email));
  useEffect(() => {
    if (!hasProgress) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasProgress]);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setPersonal(patch: Partial<ReviewPersonal>) {
    setForm((f) => ({ ...f, personal: { ...f.personal, ...patch } }));
  }
  function setProfessional(patch: Partial<ReviewProfessional>) {
    setForm((f) => ({ ...f, professional: { ...f.professional, ...patch } }));
  }
  function setCompensation(patch: Partial<ReviewCompensation>) {
    setForm((f) => ({ ...f, compensation: { ...f.compensation, ...patch } }));
  }

  async function startSession(personal: ReviewPersonal): Promise<Session> {
    const { token } = await callApi<{ token: string }>("/api/public/applications/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobPublicSlug, website, formRenderedAt: formRenderedAtRef.current }),
    });
    await callApi(`${apiBase(token)}/basic-info`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: personal.fullName.trim(),
        email: (personal.email ?? "").trim(),
        phone: normalizePhone(personal.phone ?? ""),
      }),
    });
    const session: Session = { token, acceptsResume: true, uploadedPhoto: null };
    sessionRef.current = session;
    return session;
  }

  async function readResume(file: File, personal: ReviewPersonal) {
    setResume({ status: "reading", file });
    clearFieldError("resume");
    try {
      const current = sessionRef.current;
      const session = current?.acceptsResume ? current : await startSession(personal);
      const body = new FormData();
      body.append("resume", file);
      await callApi(`${apiBase(session.token)}/resume`, { method: "POST", body });
      const outcome = await callApi<{ status: string; reason?: string }>(`${apiBase(session.token)}/parse`, {
        method: "POST",
      });
      // A failed parse still accepts a different resume; a parsed one never does.
      session.acceptsResume = outcome.status === "parse_failed";
      const { review } = await callApi<{ review: ReviewPayload }>(`${apiBase(session.token)}/review`, {
        method: "GET",
      });
      setForm((f) => fillFromResume(f, review));
      // Same rule as the other fields: only fill experience the candidate hasn't started.
      setCompanies((current) =>
        current.some((company) => !companyIsBlank(company)) ? current : groupExperiences(review.experiences)
      );
      setResume(
        outcome.status === "parse_failed"
          ? { status: "unreadable", file, note: parseFailureCopy(outcome.reason) }
          : { status: "read", file }
      );
    } catch (err) {
      // A half-finished session (e.g. stuck mid-parse) can't take another
      // resume — drop it so the next attempt starts clean.
      sessionRef.current = null;
      setResume({ status: "failed", file, message: errorMessage(err) });
    }
  }

  function chooseResume(file: File) {
    const problem = resumeFileProblem(file);
    if (problem) {
      setFieldErrors((prev) => ({ ...prev, resume: problem }));
      return;
    }
    if (basicInfoReady(form.personal)) {
      void readResume(file, form.personal);
    } else {
      clearFieldError("resume");
      setResume({ status: "waiting", file });
    }
  }

  function retryResume() {
    if (resume.status !== "failed") return;
    if (basicInfoReady(form.personal)) void readResume(resume.file, form.personal);
    else setResume({ status: "waiting", file: resume.file });
  }

  /** A resume picked before the details were complete is read as soon as they are. */
  function handleDetailsBlur() {
    if (resume.status === "waiting" && basicInfoReady(form.personal)) void readResume(resume.file, form.personal);
  }

  function choosePhoto(file: File) {
    const problem = photoFileProblem(file);
    if (problem) {
      setFieldErrors((prev) => ({ ...prev, photo: problem }));
      return;
    }
    clearFieldError("photo");
    setPhoto(file);
  }

  async function handlePreview() {
    setError(null);
    const { errors, payload, companies: filledCompanies } = validateForm(form, companies, resume, photo);
    setFieldErrors(errors);
    const firstError = FIELD_ORDER.find((key) => errors[key]);
    if (firstError) {
      setScrollTarget(`apply-${firstError}`);
      return;
    }
    const session = sessionRef.current;
    if (!session || !photo) return; // guaranteed by validateForm (resume read ⇒ session exists)

    setBusy(true);
    try {
      if (session.uploadedPhoto !== photo) {
        const body = new FormData();
        body.append("photo", photo);
        await callApi(`${apiBase(session.token)}/photo`, { method: "POST", body });
        session.uploadedPhoto = photo;
      }
      await callApi(`${apiBase(session.token)}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      session.acceptsResume = false;
      setForm(payload);
      setCompanies(filledCompanies);
      setMode("preview");
      setScrollTarget(TOP_ID);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function editSection(sectionId: string) {
    setError(null);
    setMode("form");
    setScrollTarget(sectionId);
  }

  async function handleSubmit() {
    const session = sessionRef.current;
    if (!session || !consent) return;
    setError(null);
    setBusy(true);
    try {
      const result = await callApi<{ referenceCode: string }>(`${apiBase(session.token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      setReferenceCode(result.referenceCode);
      setMode("success");
      setScrollTarget(TOP_ID);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "success") {
    return (
      <Card id={TOP_ID} className="scroll-mt-6">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-muted text-success">
            <Check className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Application submitted</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Thanks for applying for {jobTitle}. Our team will review your application and contact you at{" "}
            <span className="font-medium text-foreground">{form.personal.email}</span>.
          </p>
          {referenceCode ? (
            <p className="text-sm text-muted-foreground">
              Reference code: <span className="font-mono font-medium text-foreground">{referenceCode}</span>
            </p>
          ) : null}
          <Button asChild variant="outline" className="mt-2">
            <Link href="/apply">Browse other open positions</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "preview") {
    return (
      <ApplicationPreview
        jobTitle={jobTitle}
        form={form}
        companies={companies}
        resume={resume}
        photo={photo}
        photoUrl={photoUrl}
        consent={consent}
        onConsentChange={setConsent}
        error={error}
        busy={busy}
        onEdit={editSection}
        onSubmit={handleSubmit}
      />
    );
  }

  const reading = resume.status === "reading";
  const rolesMonths = totalExperienceMonths(companies, new Date());
  const suggestedYears = rolesMonths > 0 ? monthsToYears(rolesMonths) : null;

  return (
    <Card id={TOP_ID} className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Apply for {jobTitle}</CardTitle>
        <CardDescription>
          No account needed. Upload your resume and we&apos;ll fill in most of this form for you — you can check
          everything before you submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Honeypot — hidden from sighted users and screen readers alike;
            a filled-in value means a bot, not a candidate. */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="flex flex-col divide-y divide-border">
          <FormSection id={SECTION.details} step={1} title="Your details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="apply-fullName" label="Full name" required error={fieldErrors.fullName}>
                <Input
                  id="apply-fullName"
                  autoComplete="name"
                  value={form.personal.fullName}
                  onChange={(e) => {
                    setPersonal({ fullName: e.target.value });
                    clearFieldError("fullName");
                  }}
                  onBlur={handleDetailsBlur}
                  placeholder="Jane Doe"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={cn(fieldErrors.fullName && "border-danger")}
                />
              </Field>
              <Field id="apply-email" label="Email" required error={fieldErrors.email}>
                <Input
                  id="apply-email"
                  type="email"
                  autoComplete="email"
                  value={form.personal.email ?? ""}
                  onChange={(e) => {
                    setPersonal({ email: e.target.value });
                    clearFieldError("email");
                  }}
                  onBlur={handleDetailsBlur}
                  placeholder="jane@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={cn(fieldErrors.email && "border-danger")}
                />
              </Field>
              <Field id="apply-phone" label="Phone" required error={fieldErrors.phone}>
                <Input
                  id="apply-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.personal.phone ?? ""}
                  onChange={(e) => {
                    setPersonal({ phone: e.target.value });
                    clearFieldError("phone");
                  }}
                  onBlur={handleDetailsBlur}
                  placeholder="Mobile number with country code"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className={cn(fieldErrors.phone && "border-danger")}
                />
              </Field>
              <Field id="apply-location" label="Current location">
                <Input
                  id="apply-location"
                  autoComplete="address-level2"
                  value={form.personal.location ?? ""}
                  onChange={(e) => setPersonal({ location: e.target.value })}
                  placeholder="e.g. Hyderabad"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            id={SECTION.documents}
            step={2}
            title="Resume & photo"
            description="We'll read your resume and fill in the sections below. Please check what we filled in."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ResumePicker
                id="apply-resume"
                resume={resume}
                error={fieldErrors.resume}
                onChoose={chooseResume}
                onRetry={retryResume}
              />
              <PhotoPicker
                id="apply-photo"
                photo={photo}
                photoUrl={photoUrl}
                error={fieldErrors.photo}
                onChoose={choosePhoto}
              />
            </div>
          </FormSection>

          <FormSection id={SECTION.professional} step={3} title="Professional details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="apply-currentTitle"
                label="Current position"
                required
                error={fieldErrors.currentTitle}
                hint="Your current job title. Not working yet? Write “Fresher”."
              >
                <Input
                  id="apply-currentTitle"
                  value={form.professional.currentTitle ?? ""}
                  onChange={(e) => {
                    setProfessional({ currentTitle: e.target.value });
                    clearFieldError("currentTitle");
                  }}
                  placeholder="e.g. Software Engineer"
                  aria-invalid={Boolean(fieldErrors.currentTitle)}
                  className={cn(fieldErrors.currentTitle && "border-danger")}
                />
              </Field>
              <Field id="apply-currentCompany" label="Current company">
                <Input
                  id="apply-currentCompany"
                  value={form.professional.currentCompany ?? ""}
                  onChange={(e) => setProfessional({ currentCompany: e.target.value })}
                />
              </Field>
              <Field
                id="apply-currentCtc"
                label="Current CTC (annual, INR)"
                required
                error={fieldErrors.currentCtc}
                hint="Enter 0 if you're a fresher."
              >
                <Input
                  id="apply-currentCtc"
                  inputMode="decimal"
                  value={form.compensation.currentCtc ?? ""}
                  onChange={(e) => {
                    setCompensation({ currentCtc: e.target.value || null });
                    clearFieldError("currentCtc");
                  }}
                  placeholder="Amount in ₹ per year"
                  aria-invalid={Boolean(fieldErrors.currentCtc)}
                  className={cn(fieldErrors.currentCtc && "border-danger")}
                />
              </Field>
              <Field
                id="apply-noticePeriodDays"
                label="Notice period (days)"
                required
                error={fieldErrors.noticePeriodDays}
                hint="Enter 0 if you can join immediately."
              >
                <Input
                  id="apply-noticePeriodDays"
                  type="number"
                  min={0}
                  max={365}
                  value={form.compensation.noticePeriodDays ?? ""}
                  onChange={(e) => {
                    setCompensation({ noticePeriodDays: e.target.value === "" ? null : Number(e.target.value) });
                    clearFieldError("noticePeriodDays");
                  }}
                  placeholder="Number of days"
                  aria-invalid={Boolean(fieldErrors.noticePeriodDays)}
                  className={cn(fieldErrors.noticePeriodDays && "border-danger")}
                />
              </Field>
              <Field
                id="apply-totalExperienceYears"
                label="Total experience (years)"
                error={fieldErrors.totalExperienceYears}
                hint={
                  suggestedYears && suggestedYears !== form.professional.totalExperienceYears?.trim() ? (
                    <>
                      From your roles below: {suggestedYears} years.{" "}
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => {
                          setProfessional({ totalExperienceYears: suggestedYears });
                          clearFieldError("totalExperienceYears");
                        }}
                      >
                        Use this
                      </button>
                    </>
                  ) : undefined
                }
              >
                <Input
                  id="apply-totalExperienceYears"
                  inputMode="decimal"
                  value={form.professional.totalExperienceYears ?? ""}
                  onChange={(e) => {
                    setProfessional({ totalExperienceYears: e.target.value });
                    clearFieldError("totalExperienceYears");
                  }}
                  placeholder="Number of years"
                  aria-invalid={Boolean(fieldErrors.totalExperienceYears)}
                  className={cn(fieldErrors.totalExperienceYears && "border-danger")}
                />
              </Field>
              <Field id="apply-linkedinUrl" label="LinkedIn profile">
                <Input
                  id="apply-linkedinUrl"
                  type="url"
                  value={form.professional.linkedinUrl ?? ""}
                  onChange={(e) => setProfessional({ linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/…"
                />
              </Field>
              <Field
                id="apply-professionalSummary"
                label="Summary"
                error={fieldErrors.professionalSummary}
                className="sm:col-span-2"
              >
                <Textarea
                  id="apply-professionalSummary"
                  rows={4}
                  value={form.professional.professionalSummary ?? ""}
                  onChange={(e) => {
                    setProfessional({ professionalSummary: e.target.value });
                    clearFieldError("professionalSummary");
                  }}
                  placeholder="A few lines about your experience and what you're looking for."
                  aria-invalid={Boolean(fieldErrors.professionalSummary)}
                  className={cn(fieldErrors.professionalSummary && "border-danger")}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection id={SECTION.background} step={4} title="Experience, education & skills">
            <ExperienceEditor
              id="apply-experiences"
              companies={companies}
              showProblems={Boolean(fieldErrors.experiences)}
              error={fieldErrors.experiences}
              onChange={(next) => {
                setCompanies(next);
                // Inline messages keep updating; the summary goes once everything is fixed.
                if (fieldErrors.experiences && !experienceHasProblems(next, new Date())) clearFieldError("experiences");
              }}
            />
            <ListEditor
              id="apply-educations"
              title="Education"
              addLabel="Add education"
              rows={form.educations}
              error={fieldErrors.educations}
              onChange={(rows) => {
                setForm((f) => ({ ...f, educations: rows }));
                clearFieldError("educations");
              }}
              empty={{ institution: "" }}
              renderRow={(row, set) => (
                <>
                  <Input
                    aria-label="Institution"
                    placeholder="Institution"
                    value={row.institution}
                    onChange={(e) => set({ ...row, institution: e.target.value })}
                  />
                  <Input
                    aria-label="Degree"
                    placeholder="Degree"
                    value={row.degree ?? ""}
                    onChange={(e) => set({ ...row, degree: e.target.value })}
                  />
                </>
              )}
            />
            <SkillsEditor skills={form.skills} onChange={(skills) => setForm((f) => ({ ...f, skills }))} />
          </FormSection>
        </div>

        {error ? <ErrorAlert message={error} /> : null}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="text-danger">*</span> Required. You&apos;ll see a preview before anything is submitted.
          </p>
          <Button size="lg" onClick={handlePreview} loading={busy || reading}>
            {reading ? "Reading your resume…" : "Preview application"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Preview -----------------------------------------------------------------

function ApplicationPreview({
  jobTitle,
  form,
  companies,
  resume,
  photo,
  photoUrl,
  consent,
  onConsentChange,
  error,
  busy,
  onEdit,
  onSubmit,
}: {
  jobTitle: string;
  form: ReviewPayload;
  companies: CompanyEntry[];
  resume: ResumeState;
  photo: File | null;
  photoUrl: string | null;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  error: string | null;
  busy: boolean;
  onEdit: (sectionId: string) => void;
  onSubmit: () => void;
}) {
  const { personal, professional, compensation } = form;
  const headline = [professional.currentTitle, professional.currentCompany].filter(Boolean).join(" at ");

  return (
    <Card id={TOP_ID} className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Preview your application</CardTitle>
        <CardDescription>
          This is what we&apos;ll receive for {jobTitle}. Use Edit to change anything, then submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL of the candidate's own photo
            <img src={photoUrl} alt="Your photo" className="h-20 w-16 shrink-0 rounded-md object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{personal.fullName}</p>
            {headline ? <p className="truncate text-sm text-foreground">{headline}</p> : null}
            <p className="truncate text-sm text-muted-foreground">
              {[personal.email, personal.phone, personal.location].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <PreviewSection title="Your details" onEdit={() => onEdit(SECTION.details)}>
          <PreviewRow label="Full name" value={personal.fullName} />
          <PreviewRow label="Email" value={personal.email} />
          <PreviewRow label="Phone" value={personal.phone} />
          <PreviewRow label="Current location" value={personal.location} />
        </PreviewSection>

        <PreviewSection title="Resume & photo" onEdit={() => onEdit(SECTION.documents)}>
          <PreviewRow label="Resume" value={resume.status === "empty" ? null : resume.file.name} />
          <PreviewRow label="Photo" value={photo?.name} />
        </PreviewSection>

        <PreviewSection title="Professional details" onEdit={() => onEdit(SECTION.professional)}>
          <PreviewRow label="Current position" value={professional.currentTitle} />
          <PreviewRow label="Current company" value={professional.currentCompany} />
          <PreviewRow label="Current CTC" value={formatCtc(compensation.currentCtc)} />
          <PreviewRow
            label="Notice period"
            value={
              compensation.noticePeriodDays === 0
                ? "Can join immediately"
                : compensation.noticePeriodDays !== null
                  ? `${compensation.noticePeriodDays} days`
                  : null
            }
          />
          <PreviewRow
            label="Total experience"
            value={professional.totalExperienceYears ? `${professional.totalExperienceYears} years` : null}
          />
          <PreviewRow label="LinkedIn" value={professional.linkedinUrl} />
          <PreviewRow
            label="Summary"
            value={
              professional.professionalSummary ? (
                <span className="whitespace-pre-line">{professional.professionalSummary}</span>
              ) : null
            }
          />
        </PreviewSection>

        <PreviewSection title="Experience, education & skills" onEdit={() => onEdit(SECTION.background)}>
          <PreviewRow
            label="Experience"
            value={companies.length ? <ExperienceSummary companies={companies} /> : "None (fresher)"}
          />
          <PreviewRow
            label="Education"
            value={
              form.educations.length ? (
                <ul className="flex flex-col gap-2">
                  {form.educations.map((row, i) => (
                    <li key={i}>
                      <p className="font-medium">{row.institution}</p>
                      {row.degree || row.field ? (
                        <p className="text-muted-foreground">{[row.degree, row.field].filter(Boolean).join(", ")}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
          <PreviewRow
            label="Skills"
            value={
              form.skills.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {form.skills.map((row, i) => (
                    <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                      {row.name}
                    </span>
                  ))}
                </span>
              ) : null
            }
          />
        </PreviewSection>

        <div className="flex items-start gap-2 pt-2">
          <Checkbox id="consent" checked={consent} onCheckedChange={onConsentChange} className="mt-0.5" />
          <Label htmlFor="consent" className="text-sm font-normal text-muted-foreground">
            I confirm these details are correct, and I consent to ZEBL storing and processing them to evaluate my
            application.
          </Label>
        </div>

        {error ? <ErrorAlert message={error} /> : null}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onEdit(TOP_ID)} disabled={busy}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit application
          </Button>
          <Button size="lg" onClick={onSubmit} loading={busy} disabled={!consent}>
            Submit application
          </Button>
        </div>
        <p className="text-xs text-muted-foreground sm:text-right">You can&apos;t change your application once it&apos;s submitted.</p>
      </CardContent>
    </Card>
  );
}

function PreviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </Button>
      </div>
      <dl className="divide-y divide-border px-4">{children}</dl>
    </section>
  );
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">
        {value || <span className="text-muted-foreground">Not provided</span>}
      </dd>
    </div>
  );
}

// --- Form building blocks ----------------------------------------------------

function FormSection({
  id,
  step,
  title,
  description,
  children,
}: {
  id: string;
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4 py-6 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        >
          {step}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-5 sm:pl-9">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function FilePickerShell({
  id,
  label,
  accept,
  error,
  hint,
  icon,
  fileName,
  disabled,
  onChoose,
  children,
}: {
  id: string;
  label: string;
  accept: string;
  error?: string;
  hint: React.ReactNode;
  icon: React.ReactNode;
  fileName: string | null;
  disabled?: boolean;
  onChoose: (file: File) => void;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div id={id} className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-input`}>
        {label}
        <span className="text-danger"> *</span>
      </Label>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed bg-muted/20 p-3",
          error ? "border-danger" : "border-border"
        )}
      >
        {icon}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{fileName ?? "No file chosen"}</p>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {fileName ? "Replace" : "Choose file"}
        </Button>
      </div>
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="file"
        accept={accept}
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so choosing the same file again still fires onChange.
          e.target.value = "";
          if (file) onChoose(file);
        }}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {children}
    </div>
  );
}

function ResumePicker({
  id,
  resume,
  error,
  onChoose,
  onRetry,
}: {
  id: string;
  resume: ResumeState;
  error?: string;
  onChoose: (file: File) => void;
  onRetry: () => void;
}) {
  const iconBox = "flex h-11 w-11 shrink-0 items-center justify-center rounded-md";
  let icon = (
    <span className={cn(iconBox, "bg-muted text-muted-foreground")}>
      <FileText className="h-5 w-5" aria-hidden />
    </span>
  );
  let hint: React.ReactNode = "PDF or Word (.docx), up to 10 MB";
  switch (resume.status) {
    case "waiting":
      hint = "We'll read it once your name, email and phone are filled in.";
      break;
    case "reading":
      icon = (
        <span className={cn(iconBox, "bg-primary/10 text-primary")}>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </span>
      );
      hint = "Reading your resume…";
      break;
    case "read":
      icon = (
        <span className={cn(iconBox, "bg-success-muted text-success")}>
          <Check className="h-5 w-5" aria-hidden />
        </span>
      );
      hint = "Done. We filled in the details below.";
      break;
    case "unreadable":
      hint = "Uploaded";
      break;
    case "failed":
      hint = "Not uploaded";
      break;
  }

  return (
    <FilePickerShell
      id={id}
      label="Resume"
      accept={RESUME_ACCEPT}
      error={error ?? (resume.status === "failed" ? resume.message : undefined)}
      hint={<span aria-live="polite">{hint}</span>}
      icon={icon}
      fileName={resume.status === "empty" ? null : resume.file.name}
      disabled={resume.status === "reading"}
      onChoose={onChoose}
    >
      {resume.status === "unreadable" ? <p className="text-xs text-warning">{resume.note}</p> : null}
      {resume.status === "failed" ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </FilePickerShell>
  );
}

function PhotoPicker({
  id,
  photo,
  photoUrl,
  error,
  onChoose,
}: {
  id: string;
  photo: File | null;
  photoUrl: string | null;
  error?: string;
  onChoose: (file: File) => void;
}) {
  return (
    <FilePickerShell
      id={id}
      label="Passport-size photo"
      accept={PHOTO_ACCEPT}
      error={error}
      hint="JPEG, PNG or WebP, up to 5 MB"
      icon={
        photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL of the candidate's own photo
          <img src={photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="h-5 w-5" aria-hidden />
          </span>
        )
      }
      fileName={photo?.name ?? null}
      onChoose={onChoose}
    />
  );
}

function ListEditor<T>({
  id,
  title,
  addLabel,
  rows,
  error,
  onChange,
  empty,
  renderRow,
}: {
  id: string;
  title: string;
  addLabel: string;
  rows: T[];
  error?: string;
  onChange: (rows: T[]) => void;
  empty: T;
  renderRow: (row: T, set: (row: T) => void) => React.ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None added yet.</p>
      ) : (
        rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              {renderRow(row, (next) => {
                const copy = [...rows];
                copy[i] = next;
                onChange(copy);
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${title.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))
      )}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...rows, empty])}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}

/** Chips + a type-and-Enter box; far quicker than one input row per skill. */
function SkillsEditor({ skills, onChange }: { skills: SkillRow[]; onChange: (rows: SkillRow[]) => void }) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const names = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const existing = new Set(skills.map((s) => s.name.trim().toLowerCase()));
    const additions = names.filter((n) => !existing.has(n.toLowerCase())).map((name) => ({ name }));
    onChange([...skills, ...additions]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="apply-skill-input" className="text-sm font-medium text-foreground">
        Skills
      </Label>
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((row, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2.5 pr-1 text-xs font-medium text-foreground"
            >
              {row.name}
              <button
                type="button"
                aria-label={`Remove ${row.name}`}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-border hover:text-foreground"
                onClick={() => onChange(skills.filter((_, idx) => idx !== i))}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          id="apply-skill-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addDraft();
            }
          }}
          onBlur={addDraft}
          placeholder="Type a skill and press Enter, e.g. React"
        />
        <Button type="button" variant="outline" onClick={addDraft} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
