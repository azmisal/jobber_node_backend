import { randomUUID } from "crypto";

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
    if (typeof source !== "object" || source === null) continue;

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
  if (item == null || item === "") {
    return null;
  }
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return clean_text(item);
  } if (Array.isArray(item)) {
    return item.map(normalize_content_item).filter(Boolean);
  } if (typeof item === "object") {
    // Preserve links properly 
    if (("url" in item || "href" in item) && ("label" in item || "title" in item || "name" in item)) {
      return {
        label: clean_text(item.label || item.title || item.name || ""),
        url: clean_text(item.url || item.href || ""),
      };
    }
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
        id: randomUUID(),
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
    section.content !== undefined ? section.content :
      section.items !== undefined ? section.items :
        section.entries !== undefined ? section.entries :
          section.details;

  const content = normalize_section_content(content_value);

  return content.length || section.raw_text
    ? {
      id: clean_text(section.id) || randomUUID(),
      title,
      type,
      content,
      raw_text: clean_text(section.raw_text || section.rawText || ""),
    }
    : null;
}

function maybe_unwrap_resume_payload(data: any): any {
  if (typeof data !== "object" || data === null) {
    return {};
  }

  for (const key of ["resume", "resume_data", "resumeData", "data", "profile"]) {
    const value = data[key];

    if (
      typeof value === "object" &&
      value !== null &&
      (value.sections || value.basics || Object.keys(value).some((k) => k in SECTION_ALIASES))
    ) {
      return value;
    }
  }

  return data;
}

// =========================================================
// MAIN CANONICALIZER
// =========================================================

export function canonicalize_resume_data(resume_data: any, raw_text = ""): any {
  if (Array.isArray(resume_data)) {
    resume_data = { sections: resume_data };
  }

  const data = maybe_unwrap_resume_payload(JSON.parse(JSON.stringify(resume_data)));

  const basics_sources: any[] = [];

  if (typeof data.basics === "object" && data.basics !== null) basics_sources.push(data.basics);

  for (const key of CONTACT_KEYS) {
    if (typeof data[key] === "object" && data[key] !== null) basics_sources.push(data[key]);
  }

  basics_sources.push(data);

  const basics = merge_basics(...basics_sources);

  const sections: any[] = [];

  for (const section of ensure_list(data.sections)) {
    const norm = normalize_section(section);
    if (norm) sections.push(norm);
  }

  // Also collect extra keys from the root object that represent sections
  for (const [key, value] of Object.entries(data)) {
    if (CORE_KEYS.has(key) || CONTACT_KEYS.has(key)) continue;

    const isBasicAlias = Object.values(BASIC_ALIASES).some((aliases) => aliases.includes(key));
    if (isBasicAlias) continue;

    if (
      [
        "email",
        "emails",
        "phone",
        "phones",
        "mobile",
        "linkedin",
        "github",
        "portfolio",
        "website",
        "links",
        "urls",
        "profiles",
        "websites",
      ].includes(key)
    ) {
      continue;
    }

    const fallback_title = SECTION_ALIASES[key] || humanize_key(key);
    const norm = normalize_section(value, fallback_title);
    if (norm) sections.push(norm);
  }

  const metadata = data.metadata || {};

  const canonical = {
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

  return cleanupResumeData(canonical);
}

// =========================================================
// CLEANUP & DEDUPLICATION HELPERS
// =========================================================

export function is_project_section(section: any): boolean {
  const title = String(section?.title || "");
  const section_type = String(section?.type || "");
  return PROJECT_TITLE_RE.test(title) || PROJECT_TITLE_RE.test(section_type);
}

export function item_fingerprint(item: any): string {
  if (typeof item === "object" && item !== null) {
    const parts: string[] = [];

    for (const key of [
      "title",
      "name",
      "subtitle",
      "company",
      "organization",
      "institution",
      "role",
    ]) {
      const value = clean_text(item[key]);

      if (value) {
        parts.push(value.toLowerCase());
      }
    }

    if (parts.length > 0) {
      return parts.join("|");
    }
  }

  let serialized = JSON.stringify(item);

  serialized = serialized
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase();

  return clean_text(serialized).slice(0, 240);
}

export function merge_unique_content(target: any, source: any): void {
  const target_content = target.content || [];
  target.content = target_content;
  const source_content = source?.content || [];

  if (!Array.isArray(target_content) || !Array.isArray(source_content)) {
    return;
  }

  const seen = new Set<string>();
  for (const item of target_content) {
    const fp = item_fingerprint(item);
    if (fp) seen.add(fp);
  }

  for (const item of source_content) {
    const fp = item_fingerprint(item);

    if (fp && seen.has(fp)) {
      continue;
    }

    target_content.push(item);

    if (fp) {
      seen.add(fp);
    }
  }

  const raw_text = clean_text(source?.raw_text || "");

  if (raw_text && !clean_text(target.raw_text || "").includes(raw_text)) {
    target.raw_text = clean_text(`${target.raw_text || ""}\n${raw_text}`);
  }
}

export function normalize_text_fields(value: any): any {
  if (typeof value === "string") {
    return clean_text(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalize_text_fields);
  }
  if (typeof value === "object" && value !== null) {
    const res: any = {};
    for (const [key, child] of Object.entries(value)) {
      res[key] = normalize_text_fields(child);
    }

    return res;
  }
  return value;
}

export function cleanupResumeData(resume_data: any): any {
  if (typeof resume_data !== "object" || resume_data === null) {
    return {};
  }
  const cleaned = normalize_text_fields(JSON.parse(JSON.stringify(resume_data)));
  const sections = cleaned.sections || [];
  if (!Array.isArray(sections)) {
    cleaned.sections = [];
    return cleaned;
  }
  const normalized_sections: any[] = [];
  for (const section of sections) {
    if (typeof section !== "object" || section === null) {
      continue;
    }
    section.id = section.id || randomUUID();
    section.title = section.title || "Untitled Section";
    section.type = section.type || "custom";
    section.content = section.content || [];
    section.raw_text = section.raw_text || "";
    if (!section.content.length && !section.raw_text) {
      continue;
    }
    // Preserve project sections exactly 
    if (is_project_section(section)) {
      section.title = "Projects"; section.type = "projects";
    }
    normalized_sections.push(section);
  }
  cleaned.sections = normalized_sections;
  const metadata = cleaned.metadata || {};
  cleaned.metadata = metadata;
  metadata.section_order = normalized_sections.map((s) => s.id).filter(Boolean);
  return cleaned;
}