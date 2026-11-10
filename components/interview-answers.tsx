"use client";

import { FormEvent, useEffect, useState } from "react";

type Question = {
  id: string;
  title: string;
  prompt: string;
  hints: string[];
  code?: string;
};

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function InterviewAnswers({ questions }: { questions: Question[] }) {
  const [candidateName, setCandidateName] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [assumptions, setAssumptions] = useState("");
  const [revealedHints, setRevealedHints] = useState<number[]>(() => questions.map(() => 0));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function updateName(value: string) {
    setDirty(true);
    setCandidateName(value);
  }

  function updateAnswer(index: number, value: string) {
    setDirty(true);
    setAnswers((previous) => previous.map((answer, current) => current === index ? value : answer));
  }

  function updateAssumptions(value: string) {
    setDirty(true);
    setAssumptions(value);
  }

  function revealHint(index: number) {
    setDirty(true);
    setRevealedHints((previous) =>
      previous.map((count, current) => current === index ? Math.min(count + 1, questions[index].hints.length) : count),
    );
  }

  async function saveAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/interview-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName,
          answers: questions.map((question, index) => ({
            questionId: question.id,
            question: question.title,
            answer: answers[index],
            hintsUsed: revealedHints[index],
          })),
          assumptions,
          elapsedSeconds,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudieron guardar las respuestas.");
      setDirty(false);
      setMessage(`Respuestas guardadas en ${result.file}.`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Ocurrió un error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card questions-card" onSubmit={saveAnswers}>
      <div className="candidate-row">
        <label>
          <span className="field-label">Nombre del candidato</span>
          <input className="text-input" required maxLength={80} value={candidateName} onChange={(event) => updateName(event.target.value)} placeholder="Ej. Andrea García" />
        </label>
        <div className="candidate-actions">
          <span className="timer" aria-label="Tiempo transcurrido">{formatElapsed(elapsedSeconds)}</span>
          <button className="button" type="submit" disabled={saving || !candidateName.trim()}>{saving ? "Guardando…" : "Guardar respuestas en JSON"}</button>
        </div>
      </div>
      <div className="question-list">
        {questions.map((question, index) => (
          <div className="question" key={question.id}>
            <span className="question-number">{index + 1}</span>
            <div>
              <h3>{question.title}</h3>
              <p>{question.prompt}</p>
              {question.code && (
                <pre className="code-block"><code>{question.code}</code></pre>
              )}
              <textarea aria-label={`Respuesta a la pregunta ${index + 1}`} className="answer-input" value={answers[index]} onChange={(event) => updateAnswer(index, event.target.value)} placeholder="Registra aquí las ideas principales de la respuesta…" />
              <div className="hint-box">
                {revealedHints[index] === 0 ? (
                  <button type="button" className="hint-button" onClick={() => revealHint(index)}>Ver pista (opcional)</button>
                ) : (
                  <>
                    <div className="hint-list">
                      {question.hints.slice(0, revealedHints[index]).map((hint, hintIndex) => (
                        <p className="hint-item" key={hintIndex}><strong>Pista {hintIndex + 1}:</strong> {hint}</p>
                      ))}
                    </div>
                    <div className="hint-footer">
                      {revealedHints[index] < question.hints.length && (
                        <button type="button" className="hint-button" onClick={() => revealHint(index)}>Ver otra pista</button>
                      )}
                      <span className="hint-count">Pistas usadas: {revealedHints[index]} de {question.hints.length}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="assumptions-block">
        <label>
          <span className="field-label">Supuestos y reglas que faltan</span>
          <textarea
            className="answer-input"
            value={assumptions}
            onChange={(event) => updateAssumptions(event.target.value)}
            placeholder="Escribe aquí las reglas que no están definidas, el supuesto que tomaste y por qué. Ej.: el máximo de reserva, si un fin de sesión anticipado libera el cargador, qué pasa después de un no-show…"
          />
        </label>
      </div>
      <div className="actions">
        <button className="button" type="submit" disabled={saving || !candidateName.trim()}>{saving ? "Guardando…" : "Guardar respuestas en JSON"}</button>
        {message && <p className={`save-message${isError ? " error" : ""}`} role="status">{message}</p>}
      </div>
      <div className="notice">Las respuestas no se guardan en el almacenamiento del navegador. Al guardar, el servidor local crea un archivo JSON nuevo dentro de <code className="code">candidate-results/</code> con las respuestas, los supuestos, el tiempo transcurrido y las pistas usadas. Si cierras la página con cambios sin guardar, el navegador te pedirá confirmación.</div>
    </form>
  );
}
