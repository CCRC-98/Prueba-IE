import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TEST_VERSION = "electrolineras-v2";
const MAX_TEXT_LENGTH = 8000;
const MAX_ANSWERS = 20;

function toSafeSlug(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return slug || "candidato";
}

type AnswerPayload = {
  questionId?: string;
  question: string;
  answer: string;
  hintsUsed?: number;
};

function isAnswerPayload(item: unknown): item is AnswerPayload {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Record<string, unknown>;
  if (typeof candidate.question !== "string" || typeof candidate.answer !== "string") return false;
  if (candidate.question.length > MAX_TEXT_LENGTH || candidate.answer.length > MAX_TEXT_LENGTH) return false;
  if (candidate.questionId !== undefined && typeof candidate.questionId !== "string") return false;
  if (candidate.hintsUsed !== undefined) {
    if (typeof candidate.hintsUsed !== "number" || !Number.isInteger(candidate.hintsUsed) || candidate.hintsUsed < 0) {
      return false;
    }
  }
  return true;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Faltan los datos de la entrevista." }, { status: 400 });
  }

  const payload = body as {
    candidateName?: unknown;
    answers?: unknown;
    assumptions?: unknown;
    elapsedSeconds?: unknown;
  };

  if (typeof payload.candidateName !== "string" || !payload.candidateName.trim()) {
    return NextResponse.json({ error: "Indica el nombre del candidato." }, { status: 400 });
  }
  if (payload.candidateName.length > 80) {
    return NextResponse.json({ error: "El nombre del candidato es demasiado largo." }, { status: 400 });
  }
  if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
    return NextResponse.json({ error: "Las respuestas deben enviarse como una lista." }, { status: 400 });
  }
  if (payload.answers.length > MAX_ANSWERS) {
    return NextResponse.json({ error: "Se recibieron demasiadas respuestas." }, { status: 400 });
  }
  if (payload.assumptions !== undefined && typeof payload.assumptions !== "string") {
    return NextResponse.json({ error: "Los supuestos deben enviarse como texto." }, { status: 400 });
  }
  if (typeof payload.assumptions === "string" && payload.assumptions.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "El texto de supuestos es demasiado largo." }, { status: 400 });
  }
  if (payload.elapsedSeconds !== undefined) {
    if (typeof payload.elapsedSeconds !== "number" || !Number.isFinite(payload.elapsedSeconds) || payload.elapsedSeconds < 0) {
      return NextResponse.json({ error: "El tiempo transcurrido debe ser un número válido." }, { status: 400 });
    }
  }

  const filteredAnswers = payload.answers.filter(isAnswerPayload);
  if (filteredAnswers.length !== payload.answers.length) {
    return NextResponse.json({ error: "Una o más respuestas tienen un formato inválido." }, { status: 400 });
  }
  const answers = filteredAnswers.map(({ questionId, question, answer, hintsUsed }) => ({
    questionId,
    question,
    answer,
    hintsUsed,
  }));

  const folderName = `${toSafeSlug(payload.candidateName)}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const resultsDirectory = path.join(process.cwd(), "candidate-results", folderName);
  const outputFile = path.join(resultsDirectory, "answers.json");
  const result = {
    candidateName: payload.candidateName.trim(),
    savedAt: new Date().toISOString(),
    testVersion: TEST_VERSION,
    elapsedSeconds: typeof payload.elapsedSeconds === "number" ? Math.floor(payload.elapsedSeconds) : null,
    assumptions: typeof payload.assumptions === "string" ? payload.assumptions : "",
    answers,
  };

  try {
    await mkdir(resultsDirectory, { recursive: true });
    await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return NextResponse.json({ ok: true, file: `candidate-results/${folderName}/answers.json` });
  } catch {
    return NextResponse.json({ error: "No se pudieron escribir las respuestas en el servidor local." }, { status: 500 });
  }
}
