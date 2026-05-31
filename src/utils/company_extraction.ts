// src/utils/companyExtraction.ts

const cleanCompany = (
  value: string
): string => {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:"'\n\t]+$/, "");
};

export const extractCompanyNameFromJd = (
  jdText: string
): [string | null, number] => {
  /**
   * Best-effort company extraction.
   *
   * Returns:
   * [companyName, confidence]
   */

  const text = (jdText || "").trim();

  if (!text) {
    return [null, 0.0];
  }

  // Normalize whitespace
  const compact = text.replace(/\s+/g, " ");

  const patterns: Array<[RegExp, number]> = [
    // Software Engineer at Acme Corp
    [
      /\bat\s+([A-Z][A-Za-z0-9&.,\- ]{1,80})/,
      0.8,
    ],

    // Company: Acme Corp
    [
      /\b(?:Company|Employer)\s*[:\-]\s*([A-Z][A-Za-z0-9&.,\- ]{1,80})/,
      0.9,
    ],

    // for Acme Corp
    [
      /\bfor\s+([A-Z][A-Za-z0-9&.,\- ]{1,80})/,
      0.55,
    ],
  ];

  for (const [pattern, confidence] of patterns) {
    const match = compact.match(pattern);

    if (!match) {
      continue;
    }

    const company = cleanCompany(match[1]);

    // Reject invalid captures
    if (
      company &&
      company.length >= 2
    ) {
      const invalidWords = new Set([
        "we",
        "you",
        "the",
        "our",
        "your",
      ]);

      if (
        invalidWords.has(
          company.toLowerCase()
        )
      ) {
        continue;
      }

      return [company, confidence];
    }
  }

  return [null, 0.0];
};