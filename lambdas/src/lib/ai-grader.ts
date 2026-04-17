import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { env } from "../env.js";

// Claude on Bedrock via Anthropic Messages API.
// Default model: claude-haiku-4-5 (Anthropic's small fast model — enough to
// grade short-text assignments; upgrade to Sonnet for harder rubrics).
const DEFAULT_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0";

let client: BedrockRuntimeClient | null = null;
function bedrock(): BedrockRuntimeClient {
  if (!client) client = new BedrockRuntimeClient({ region: env.region });
  return client;
}

export type GradingInput = {
  subject: string;
  rubric?: string;
  submission: string;
  maxScore?: number;
};

export type GradingOutput = {
  score: number;
  maxScore: number;
  feedback: string;
  modelId: string;
};

const GRADING_SYSTEM_PROMPT = `You are an impartial, constructive academic grader for a tutoring platform. You receive a student submission and, optionally, a teacher-provided rubric. Return a JSON object with exactly:

{
  "score": <integer 0..maxScore>,
  "feedback": "<2-5 sentences of specific constructive feedback citing concrete parts of the submission>"
}

Guidance:
- If a rubric is provided, score strictly against it. If not, score for correctness, clarity, and depth for the stated subject.
- Feedback should be encouraging but honest; point out at least one strength AND one area to improve.
- Never include private/personal info. Never invent facts about the student.
- Output ONLY the JSON object, no prose around it.`;

function buildUserPrompt(input: GradingInput): string {
  const maxScore = input.maxScore ?? 100;
  const rubricBlock = input.rubric
    ? `RUBRIC (from teacher):\n${input.rubric}\n\n`
    : "No rubric provided — grade for correctness, clarity, and depth.\n\n";
  return `SUBJECT: ${input.subject}
MAX SCORE: ${maxScore}

${rubricBlock}STUDENT SUBMISSION:
"""
${input.submission}
"""

Return ONLY the JSON object described in the system prompt.`;
}

export async function gradeSubmission(input: GradingInput): Promise<GradingOutput> {
  const modelId = env.bedrockGradingModelId || DEFAULT_MODEL_ID;
  const maxScore = input.maxScore ?? 100;
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 600,
    system: GRADING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    temperature: 0.2,
  });

  const res = await bedrock().send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    }),
  );
  const payload = JSON.parse(new TextDecoder().decode(res.body));

  // Bedrock's Anthropic response shape: { content: [{ type: "text", text: "..." }], ... }
  const textBlocks = Array.isArray(payload.content) ? payload.content : [];
  const raw = textBlocks
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");

  const parsed = extractJson(raw);
  if (!parsed) {
    throw new Error("ai_grader: model returned non-JSON response");
  }

  const score = Number(parsed.score);
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    throw new Error(`ai_grader: score out of range (${parsed.score})`);
  }
  if (typeof parsed.feedback !== "string" || parsed.feedback.trim().length < 10) {
    throw new Error("ai_grader: feedback missing or too short");
  }

  return {
    score: Math.round(score),
    maxScore,
    feedback: parsed.feedback.trim(),
    modelId,
  };
}

// Claude sometimes wraps JSON in ```json fences or prose. Strip those before
// JSON.parse so we're not brittle to minor formatting drift.
function extractJson(text: string): { score?: unknown; feedback?: unknown } | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch?.[1] ?? text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}
