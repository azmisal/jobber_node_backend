import { v4 as uuidv4 } from "uuid";

// =========================================================
// REGEX
// =========================================================

const PROJECT_TITLE_RE =
  /\b(projects?|team projects?|academic projects?|personal projects?|portfolio projects?|key projects?|selected projects?)\b/i;

const WHITESPACE_RE = /\s+/g;

// =========================================================
// CONSTANTS
// =========================================================

const CORE_KEYS = new Set([
  "basics",
  "metadata",
  "sections",
  "raw_resume_text",
]);

const BASIC_ALIASES: Record<string, string[]> = {
  full_name: ["full_name", "fullName", "name", "candidate_name", "candidateName"],
  headline: ["headline", "title", "role", "summary_title", "professional_title"],
  location: ["location", "address", "city"],
};

const CONTACT_KEYS = new Set([
  "contact",
  "contacts",
  "contact_info",
  "contactInfo",
  "personal_info",
  "personalInfo",
]);

const SECTION_ALIASES: Record<string, string> = {
  summary: "Summary",
  profile: "Summary",
  objective: "Summary",
  experience: "Experience",
  work_experience: "Experience",
  workExperience: "Experience",
  employment: "Experience",
  professional_experience: "Experience",
  professionalExperience: "Experience",
  projects: "Projects",
  team_projects: "Projects",
  teamProjects: "Projects",
  academic_projects: "Projects",
  academicProjects: "Projects",
  personal_projects: "Projects",
  personalProjects: "Projects",
  education: "Education",
  skills: "Skills",
  technical_skills: "Skills",
  technicalSkills: "Skills",
  certifications: "Certifications",
  certificates: "Certifications",
  awards: "Awards",
  achievements: "Achievements",
  publications: "Publications",
  languages: "Languages",
};

// =========================================================
// HELPERS
// =========================================================

function clean_text(value: any): string {
  let text = String(value || "").trim();
  text = text.replace(WHITESPACE_RE, " ");
  text = text.replace(" ,", ",").replace(" .", ".");
  text = text.replace(" ;", ";").replace(" :", ":");
  text = text.replace("• •", "•");
  return text;
}

function normalize_title(title: string): string {
  let normalized = clean_text(title).toLowerCase();
  normalized = normalized.replace(/[^a-z0-9]+/g, " ").trim();
  return normalized;
}

function humanize_key(key: string): string {
  let k = String(key || "");
  k = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  k = k.replace(/[_-]/g, " ");
  k = k.replace(WHITESPACE_RE, " ").trim();
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : "Custom";
}

function first_value(source: any, aliases: string[]): string {
  for (const alias of aliases) {
    const value = source?.[alias];
    if (typeof value === "string" && value.trim()) {
      return clean_text(value);
    }
  }
  return "";
}

function ensure_list(value: any): any[] {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function normalize_string_list(value: any): string[] {
  const values: string[] = [];

  for (let item of ensure_list(value)) {
    if (typeof item === "object" && item !== null) {
      item =
        item.value ||
        item.text ||
        item.label ||
        item.url ||
        "";
    }

    item = clean_text(item);

    if (item && !values.some((v) => v.toLowerCase() === item.toLowerCase())) {
      values.push(item);
    }
  }

  return values;
}

function normalize_links(value: any): any[] {
  const links: any[] = [];

  for (const item of ensure_list(value)) {
    let label = "";
    let url = "";

    if (typeof item === "string") {
      url = clean_text(item);
    } else if (typeof item === "object" && item) {
      label = clean_text(
        item.label || item.name || item.title || item.type || ""
      );
      url = clean_text(item.url || item.href || item.link || item.value || "");
    }

    if (!url) continue;

    const exists = links.some(
      (l) =>
        (l.label || "").toLowerCase() === label.toLowerCase() &&
        (l.url || "").toLowerCase() === url.toLowerCase()
    );

    if (!exists) {
      links.push({ label, url });
    }
  }

  return links;
}

// =========================================================
// BASICS MERGE
// =========================================================

function merge_basics(...sources: any[]): any {
  const basics: any = {
    full_name: "",
    headline: "",
    emails: [],
    phones: [],
    location: "",
    links: [],
  };

  for (const source of sources) {
    if (typeof source !== "object") continue;

    for (const [target, aliases] of Object.entries(BASIC_ALIASES)) {
      if (basics[target]) continue;
      basics[target] = first_value(source, aliases);
    }

    basics.emails.push(...normalize_string_list(source.emails || source.email));
    basics.phones.push(
      ...normalize_string_list(source.phones || source.phone || source.mobile)
    );

    basics.links.push(
      ...normalize_links(
        source.links ||
          source.urls ||
          source.profiles ||
          source.websites
      )
    );

    for (const key of ["linkedin", "github", "portfolio", "website"]) {
      if (source[key]) {
        basics.links.push(
          ...normalize_links({
            label: humanize_key(key),
            url: source[key],
          })
        );
      }
    }
  }

  basics.emails = normalize_string_list(basics.emails);
  basics.phones = normalize_string_list(basics.phones);
  basics.links = normalize_links(basics.links);

  return basics;
}

// =========================================================
// SECTION NORMALIZATION
// =========================================================

function normalize_content_item(item: any): any {
  if (item == null || item === "") return null;

  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return clean_text(item);
  }

  if (Array.isArray(item)) {
    return item.map(normalize_content_item).filter(Boolean);
  }

  if (typeof item === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(item)) {
      const nv = normalize_content_item(v);
      if (nv !== null && nv !== "" && !(Array.isArray(nv) && nv.length === 0)) {
        out[k] = nv;
      }
    }
    return out;
  }

  return clean_text(item);
}

function normalize_section_content(value: any): any[] {
  if (!value) return [];

  const raw = Array.isArray(value) ? value : [value];
  const out: any[] = [];

  for (const item of raw) {
    const norm = normalize_content_item(item);
    if (norm) {
      Array.isArray(norm) ? out.push(...norm) : out.push(norm);
    }
  }

  return out;
}

function normalize_section(section: any, fallback_title = "Custom"): any | null {
  if (!section) return null;

  if (typeof section !== "object") {
    const content = normalize_section_content(section);
    return content.length
      ? {
          id: uuidv4(),
          title: fallback_title,
          type: normalize_title(fallback_title) || "custom",
          content,
          raw_text: "",
        }
      : null;
  }

  const title = clean_text(section.title || section.heading || section.name || fallback_title);
  const type = clean_text(section.type || normalize_title(title) || "custom");

  const content_value =
    section.content ??
    section.items ??
    section.entries ??
    section.details;

  const content = normalize_section_content(content_value);

  return content.length || section.raw_text
    ? {
        id: clean_text(section.id) || uuidv4(),
        title,
        type,
        content,
        raw_text: clean_text(section.raw_text || section.rawText || ""),
      }
    : null;
}

// =========================================================
// MAIN CANONICALIZER
// =========================================================

export function canonicalize_resume_data(resume_data: any, raw_text = ""): any {
  if (Array.isArray(resume_data)) {
    resume_data = { sections: resume_data };
  }

  const data = JSON.parse(JSON.stringify(resume_data));

  const basics_sources: any[] = [];

  if (typeof data.basics === "object") basics_sources.push(data.basics);

  for (const key of CONTACT_KEYS) {
    if (typeof data[key] === "object") basics_sources.push(data[key]);
  }

  basics_sources.push(data);

  const basics = merge_basics(...basics_sources);

  const sections: any[] = [];

  for (const section of ensure_list(data.sections)) {
    const norm = normalize_section(section);
    if (norm) sections.push(norm);
  }

  const metadata = data.metadata || {};

  return {
    basics,
    sections,
    metadata: {
      section_order: metadata.section_order || [],
      parsing_confidence: metadata.parsing_confidence || 0,
      embedded_links: metadata.embedded_links || [],
      plain_resume_text: metadata.plain_resume_text || "",
    },
    raw_resume_text: clean_text(data.raw_resume_text || data.rawText || raw_text || ""),
  };
}