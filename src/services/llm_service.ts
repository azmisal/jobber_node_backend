// src/services/llm.service.ts

import OpenAI from "openai";
import { randomUUID } from "crypto";

import {
  RESUME_PARSE_PROMPT,
  KEYWORD_EXTRACTION_PROMPT,
  OPTIMIZATION_PROMPT,
  COVER_LETTER_PROMPT,
} from "../constants/llm_prompts";

/* =====================================================
   LLM CONFIG
===================================================== */

const LLM_CONFIGS: any = {
  groq: {
    client: new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.JOBBER_GROQ_API_KEY,
    }),

    model: "llama-3.3-70b-versatile",
  },

  huggingface: {
    client: new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: process.env.HUGGINGFACE_API_KEY,
    }),

    model: "meta-llama/Llama-3.3-70B-Instruct",
  },

  openrouter: {
    client: new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    }),

    model: "meta-llama/llama-3.3-70b-instruct",
  },

  ollama: {
    client: new OpenAI({
      baseURL: `${process.env.OLLAMA_BASE_URL}/v1`,
      apiKey: "ollama",
    }),

    model: "llama3.1:8b",
  },
};

/* =====================================================
   GET LLM
===================================================== */

const getLLM = (modelId: string) => {
  const config = LLM_CONFIGS[modelId];

  if (!config) {
    throw new Error(
      `Unsupported model ID: ${modelId}`
    );
  }

  return {
    client: config.client,
    model: config.model,
  };
};

/* =====================================================
   PARSE RESUME TO JSON
===================================================== */

export const parseResumeToJson = async (
  rawText: string,
  modelId: string,
  embeddedLinks: any[] = []
) => {
  const { client, model } = getLLM(modelId);

  const prompt = `
${RESUME_PARSE_PROMPT}

==================================================
EMBEDDED LINKS
==================================================

${JSON.stringify(embeddedLinks)}

==================================================
RESUME
==================================================

${rawText}
`;

  const response =
    await client.chat.completions.create({
      model,

      messages: [
        {
          role: "system",
          content:
            "You are a universal resume parser. Return ONLY valid JSON.",
        },

        {
          role: "user",
          content: prompt,
        },
      ],

      response_format: {
        type: "json_object",
      },

      temperature: 0.1,
    });

  const parsed = JSON.parse(
    response.choices[0].message.content || "{}"
  );

  parsed.basics ??= {};
  parsed.sections ??= [];
  parsed.metadata ??= {};
  parsed.raw_resume_text ??= rawText;

  for (const section of parsed.sections) {
    if (!section.id) {
      section.id = randomUUID();
    }
  }

  return parsed;
};

/* =====================================================
   EXTRACT ATS KEYWORDS
===================================================== */

export const extractKeywords = async (
  jdText: string,
  existingResumeData: any,
  modelId: string
) => {
  const { client, model } = getLLM(modelId);

  const prompt = `
${KEYWORD_EXTRACTION_PROMPT}

==================================================
JOB DESCRIPTION
==================================================

${jdText}

==================================================
RESUME DATA
==================================================

${JSON.stringify(existingResumeData)}
`;

  const response =
    await client.chat.completions.create({
      model,

      messages: [
        {
          role: "system",
          content:
            "You extract ATS keywords. Return ONLY valid JSON.",
        },

        {
          role: "user",
          content: prompt,
        },
      ],

      response_format: {
        type: "json_object",
      },

      temperature: 0.1,
    });

  const parsed = JSON.parse(
    response.choices[0].message.content || "{}"
  );

  return parsed.keywords || [];
};

/* =====================================================
   GENERATE OPTIMIZATION PROPOSALS
===================================================== */

export const generateOptimizationProposals =
  async (
    resumeData: any,
    selectedKeywords: string[],
    modelId: string
  ) => {
    const { client, model } =
      getLLM(modelId);

    const prompt = `
${OPTIMIZATION_PROMPT}

==================================================
KEYWORDS
==================================================

${JSON.stringify(selectedKeywords)}

==================================================
RESUME
==================================================

${JSON.stringify(resumeData)}
`;

    const response =
      await client.chat.completions.create({
        model,

        messages: [
          {
            role: "system",
            content:
              "You optimize resumes for ATS systems. Return ONLY JSON.",
          },

          {
            role: "user",
            content: prompt,
          },
        ],

        response_format: {
          type: "json_object",
        },

        temperature: 0.2,
      });

    const parsed = JSON.parse(
      response.choices[0].message.content ||
        "{}"
    );

    return parsed.proposals || [];
  };

/* =====================================================
   CREATE COVER LETTER
===================================================== */

export const createCoverLetter =
  async (
    resumeData: any,
    jdText: string,
    modelId: string
  ) => {
    const { client, model } =
      getLLM(modelId);

    const prompt = `
${COVER_LETTER_PROMPT}

==================================================
RESUME
==================================================

${JSON.stringify(resumeData)}

==================================================
JOB DESCRIPTION
==================================================

${jdText}
`;

    const response =
      await client.chat.completions.create({
        model,

        messages: [
          {
            role: "system",
            content:
              "You are an expert cover letter writer.",
          },

          {
            role: "user",
            content: prompt,
          },
        ],

        temperature: 0.3,
      });

    return (
      response.choices[0].message.content || ""
    );
  };