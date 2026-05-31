const pdf = require("pdf-parse");
// =========================================================
// REGEX
// =========================================================
export const EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export const URL_RE =
  /(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?<!@)\b(?:linkedin\.com|github\.com)\/[^\s<>()]+|(?<!@)\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\.(?:app|co|com|dev|in|io|me|net|org)(?:\/[^\s<>()]*)?)/gi;

export const PHONE_RE =
  /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}(?!\w)/g;

export const SECTION_HEADING_RE =
  /^(summary|profile|objective|experience|work experience|employment|projects?|education|skills?|technical skills|certifications?|awards?|publications?|languages?|achievements?)$/i;
// =========================================================
// UTILITIES
// =========================================================

export function normalizeUrl(url: string): string {
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
  const href = escape_href(normalizeUrl(url));
  if (!href) return label;
  return `<a href="${href}">${label}</a>`;
}

export function classify_link_label(url: string, fallback = ""): string {
  if (fallback) return clean_link_label(fallback);

  const parsed = normalizeUrl(url).toLowerCase();

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
    normalizeUrl(link?.url || "").toLowerCase()
  );
}

export function append_unique_link(
  links: any[],
  label: string,
  url: string,
  extra: any = null
) {
  label = clean_link_label(label);
  url = normalizeUrl(url);

  if (!url) return;

  const candidate = {
    label,
    url,
    ...(extra || {}),
  };

  const exists = links.some(
    (l) =>
      normalizeUrl(l.url || "").toLowerCase() ===
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
    const url = normalizeUrl(match[0]);
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
  const url = normalizeUrl(link?.url || "").toLowerCase();

  return !!(
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

export async function extractResumePdfContext(
  fileBuffer: Buffer
) {

  const data = await Promise.race([
    pdf(fileBuffer),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("PDF parse timeout")), 10000)
    ),
  ]);

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
    embedded_links: [],
  };
}

export function merge_contact_details(...sources: any[]): any {
  const merged: { emails: string[]; phones: string[]; links: any[] } = {
    emails: [],
    phones: [],
    links: [],
  };

  for (const source of sources) {
    if (typeof source !== "object" || source === null) continue;

    for (const email of as_list(source.emails)) {
      const trimmed = String(email || "").trim();
      if (trimmed && !merged.emails.some((e) => e.toLowerCase() === trimmed.toLowerCase())) {
        merged.emails.push(trimmed);
      }
    }

    for (const phone of as_list(source.phones)) {
      const cleaned = clean_link_label(phone);
      if (cleaned && !merged.phones.includes(cleaned)) {
        merged.phones.push(cleaned);
      }
    }

    for (const link of as_list(source.links)) {
      if (typeof link === "object" && link !== null) {
        append_unique_link(merged.links, link.label || "", link.url || "");
      }
    }
  }

  return merged;
}

export function enrich_resume_data_with_pdf_context(
  resume_data: any,
  pdf_context: any
): any {
  if (typeof resume_data !== "object" || resume_data === null) {
    resume_data = {};
  }

  const basics = resume_data.basics || {};
  resume_data.basics = basics;
  const metadata = resume_data.metadata || {};
  resume_data.metadata = metadata;

  const contacts = pdf_context.contact_details || {};
  const contact_link_urls = new Set(
    as_list(contacts.links)
      .filter((link) => typeof link === "object" && link !== null)
      .map((link) => normalizeUrl(link.url || "").toLowerCase())
  );

  const existing_links = as_list(basics.links).filter(
    (link) =>
      typeof link === "object" &&
      link !== null &&
      contact_link_urls.has(normalizeUrl(link.url || "").toLowerCase())
  );

  const existing_contacts = {
    emails: basics.emails || [],
    phones: basics.phones || [],
    links: existing_links,
  };

  const merged_contacts = merge_contact_details(existing_contacts, contacts);

  basics.emails = merged_contacts.emails;
  basics.phones = merged_contacts.phones;
  basics.links = merged_contacts.links;

  const embedded_links: any[] = [];
  for (const link of as_list(metadata.embedded_links)) {
    if (typeof link === "object" && link !== null) {
      append_unique_link(embedded_links, link.label || "", link.url || "");
    }
  }

  for (const link of as_list(pdf_context.embedded_links)) {
    if (typeof link === "object" && link !== null) {
      append_unique_link(embedded_links, link.label || "", link.url || "");
    }
  }

  metadata.embedded_links = embedded_links;

  if (pdf_context.plain_text) {
    metadata.plain_resume_text = pdf_context.plain_text;
  }

  return resume_data;
}

// =========================================================
// PDF GENERATION (ASYNC PDFKIT VERSION)
// =========================================================
import PDFDocument from "pdfkit";

function writeDivider(doc: PDFKit.PDFDocument) {
  const y = doc.y;

  doc
    .moveTo(50, y)
    .lineTo(545, y)
    .strokeColor("#cccccc")
    .stroke();

  doc.moveDown(0.8);
}

function writeSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#111")
    .text(title.toUpperCase(), {
      align: "left",
    });

  writeDivider(doc);
}

function writeBullet(
  doc: PDFKit.PDFDocument,
  text: string
) {
  if (!text?.trim()) return;

  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor("#222")
    .text(`• ${text}`, {
      indent: 14,
      paragraphGap: 3,
      lineGap: 1,
    });
}

function writeExperienceItem(
  doc: PDFKit.PDFDocument,
  item: any
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111")
    .text(
      `${item.position || ""} ${
        item.company ? `— ${item.company}` : ""
      }`,
      {
        continued: false,
      }
    );

  if (item.dates) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9.5)
      .fillColor("#666")
      .text(item.dates);
  }

  doc.moveDown(0.3);

  for (const achievement of item.achievements || []) {
    writeBullet(doc, achievement);
  }

  doc.moveDown(0.8);
}

function writeProjectItem(
  doc: PDFKit.PDFDocument,
  item: any
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111")
    .text(item.name || "");

  if (item.link) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#666")
      .text(item.link);
  }

  if (item.description) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#222")
      .text(item.description, {
        lineGap: 2,
      });
  }

  doc.moveDown(0.8);
}

function writeEducationItem(
  doc: PDFKit.PDFDocument,
  item: any
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111")
    .text(item.degree || "");

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#222")
    .text(item.institution || "");

  if (item.cgpa) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#666")
      .text(`CGPA: ${item.cgpa}`);
  }

  doc.moveDown(0.8);
}

function writeSkillsSection(
  doc: PDFKit.PDFDocument,
  skills: string[]
) {
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor("#222")
    .text(skills.join(" • "), {
      lineGap: 4,
    });

  doc.moveDown(0.8);
}

export function generatePdfBytes(
  resume_data: any
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
      });

      const chunks: Buffer[] = [];

      doc.on("data", (c: Buffer) =>
        chunks.push(c)
      );

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", reject);

      const basics =
        resume_data?.basics || {};

      const sections =
        resume_data?.sections || [];

      // =====================================================
      // HEADER
      // =====================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#111")
        .text(basics.full_name || "", {
          align: "center",
        });

      doc.moveDown(0.3);

      const contactParts = [
        ...(basics.emails || []),
        ...(basics.phones || []),
        basics.location,
      ].filter(Boolean);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#555")
        .text(contactParts.join(" | "), {
          align: "center",
        });

      doc.moveDown(1.2);

      // =====================================================
      // SECTIONS
      // =====================================================

      for (const section of sections) {
        if (
          !section ||
          !Array.isArray(section.content)
        ) {
          continue;
        }

        writeSectionTitle(
          doc,
          section.title || "Section"
        );

        // SUMMARY / TEXT
        if (
          section.type === "text" ||
          section.id === "summary"
        ) {
          for (const item of section.content) {
            doc
              .font("Helvetica")
              .fontSize(10.5)
              .fillColor("#222")
              .text(String(item), {
                lineGap: 3,
              });
          }

          doc.moveDown(1);
          continue;
        }

        // EXPERIENCE
        if (
          section.type === "experience"
        ) {
          for (const item of section.content) {
            writeExperienceItem(doc, item);
          }

          continue;
        }

        // PROJECTS
        if (
          section.type === "projects"
        ) {
          for (const item of section.content) {
            writeProjectItem(doc, item);
          }

          continue;
        }

        // EDUCATION
        if (
          section.type === "education"
        ) {
          for (const item of section.content) {
            writeEducationItem(doc, item);
          }

          continue;
        }

        // SKILLS
        if (
          section.type === "skills"
        ) {
          writeSkillsSection(
            doc,
            section.content
          );

          continue;
        }

        // FALLBACK
        for (const item of section.content) {
          if (typeof item === "string") {
            writeBullet(doc, item);
            continue;
          }

          doc
            .font("Helvetica")
            .fontSize(10)
            .text(JSON.stringify(item));
        }

        doc.moveDown(1);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}