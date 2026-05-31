import * as html from "node:util";
import pdf from "pdf-parse";

// =========================================================
// REGEX
// =========================================================

export const EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export const URL_RE =
  /(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?<!@)\b(?:linkedin\.com|github\.com)\/[^\s<>()]+|(?<!@)\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\.(?:app|co|com|dev|in|io|me|net|org)(?:\/[^\s<>()]*)?)/i;

export const PHONE_RE =
  /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}(?!\w)/;

export const SECTION_HEADING_RE =
  /^(summary|profile|objective|experience|work experience|employment|projects?|education|skills?|technical skills|certifications?|awards?|publications?|languages?|achievements?)$/i;

// =========================================================
// UTILITIES
// =========================================================

export function normalize_url(url: string): string {
  url = (url || "").trim().replace(/[.,;:]+$/, "");
  if (!url) return "";

  const lower = url.toLowerCase();

  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) return url;

  if (lower.startsWith("www.")) return `https://${url}`;

  if (url.includes("/") && url.split("/")[0].includes(".")) {
    return `https://${url}`;
  }

  if (url.includes(".") && !url.includes("@")) {
    return `https://${url}`;
  }

  return url;
}

export function clean_link_label(label: string): string {
  return (label || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[ \t\n\r|•\-–—:;]+$/g, "");
}

export function as_list(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

export function escape_href(url: string): string {
  return (url || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function make_anchor(label: string, url: string): string {
  const href = escape_href(normalize_url(url));
  if (!href) return label;
  return `<a href="${href}">${label}</a>`;
}

export function classify_link_label(url: string, fallback = ""): string {
  if (fallback) return clean_link_label(fallback);

  const parsed = normalize_url(url).toLowerCase();

  if (parsed.includes("linkedin.com")) return "LinkedIn";
  if (parsed.includes("github.com")) return "GitHub";
  if (parsed.startsWith("mailto:")) return "Email";
  if (parsed.startsWith("tel:")) return "Phone";

  return "Portfolio";
}

// =========================================================
// LINK CORE
// =========================================================

export function link_key(link: any): string {
  return (
    clean_link_label(link?.label || "").toLowerCase() +
    "|" +
    normalize_url(link?.url || "").toLowerCase()
  );
}

export function append_unique_link(
  links: any[],
  label: string,
  url: string,
  extra: any = null
) {
  label = clean_link_label(label);
  url = normalize_url(url);

  if (!url) return;

  const candidate = {
    label,
    url,
    ...(extra || {}),
  };

  const exists = links.some(
    (l) =>
      normalize_url(l.url || "").toLowerCase() ===
      url.toLowerCase()
  );

  if (!exists) {
    links.push(candidate);
  }
}

// =========================================================
// CONTACT EXTRACTION
// =========================================================

export function extract_contacts_from_text(text: string) {
  const emails: string[] = [];
  const phones: string[] = [];
  const links: any[] = [];

  let match;

  while ((match = EMAIL_RE.exec(text))) {
    if (!emails.includes(match[0])) emails.push(match[0]);
  }

  while ((match = PHONE_RE.exec(text))) {
    const phone = match[0];
    if (!phones.includes(phone)) phones.push(phone);
  }

  while ((match = URL_RE.exec(text))) {
    const url = normalize_url(match[0]);
    append_unique_link(links, classify_link_label(url), url);
  }

  return { emails, phones, links };
}

// =========================================================
// TEXT HELPERS
// =========================================================

export function extract_contact_block(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const contact_lines: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 18); i++) {
    const line = lines[i];

    if (contact_lines.length && SECTION_HEADING_RE.test(line)) {
      break;
    }

    contact_lines.push(line);

    if (contact_lines.length >= 10) break;
  }

  return contact_lines.join("\n");
}

export function is_link_in_text(link: any, text: string): boolean {
  const haystack = (text || "").toLowerCase();
  const label = clean_link_label(link?.label || "").toLowerCase();
  const url = normalize_url(link?.url || "").toLowerCase();

  return (
    (label && haystack.includes(label)) ||
    (url && haystack.includes(url))
  );
}

export function filter_links_by_text(links: any[], text: string) {
  const filtered: any[] = [];

  for (const link of as_list(links)) {
    if (!link?.url) continue;

    if (is_link_in_text(link, text)) {
      append_unique_link(filtered, link.label, link.url);
    }
  }

  return filtered;
}

// =========================================================
// ANNOTATION
// =========================================================

export function annotate_links(text: string): string {
  if (!text) return "";

  const replaced = text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
      make_anchor(label, url)
    )
    .replace(URL_RE, (url) => make_anchor(url, url));

  return replaced;
}

// =========================================================
// PDF EXTRACTION
// =========================================================

export async function extract_resume_pdf_context(
  fileBuffer: Buffer
) {
  const data = await pdf(fileBuffer);

  const raw_text = data.text || "";

  if (!raw_text.trim()) {
    throw new Error("Unable to read PDF.");
  }

  const contact_block = extract_contact_block(raw_text);

  const contact_details = {
    ...extract_contacts_from_text(raw_text),
    links: [
      ...extract_contacts_from_text(contact_block).links,
    ],
  };

  return {
    text: raw_text,
    plain_text: raw_text,
    contact_block,
    contact_details,
  };
}

// =========================================================
// PDF GENERATION (SIMPLIFIED NODE VERSION)
// =========================================================

import PDFDocument from "pdfkit";

export function generate_pdf_bytes(resume_data: any): Buffer {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(c));

  const basics = resume_data?.basics || {};
  const sections = resume_data?.sections || [];

  doc.fontSize(20).text(basics.full_name || "", {
    align: "center",
  });

  doc.moveDown();

  for (const section of sections) {
    if (section.title) {
      doc.fontSize(14).text(section.title.toUpperCase());
    }

    for (const item of section.content || []) {
      if (typeof item === "string") {
        doc.fontSize(10).text(item);
      } else {
        if (item.title) doc.text(item.title);
        for (const b of item.bullets || []) {
          doc.text("• " + b);
        }
      }
    }

    doc.moveDown();
  }

  doc.end();

  return Buffer.concat(chunks);
}