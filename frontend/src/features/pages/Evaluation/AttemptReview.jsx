import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadAnswerFile,
  gradeAnswer,
  gradeAnswerWithAi,
  publishResults,
  reviewAttempt,
} from "@/services/attempt.service";

function isQuestionGraded(question) {
  return typeof question.answer?.score === "number";
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function QuestionReview({
  attemptId,
  question,
  onManualGrade,
  onAiGrade,
  savingKey,
}) {
  const [score, setScore] = useState(question.answer?.score ?? "");
  const [feedback, setFeedback] = useState(question.answer?.feedback || "");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setScore(question.answer?.score ?? "");
    setFeedback(question.answer?.feedback || "");
  }, [question.answer?.score, question.answer?.feedback]);

  const isTextQuestion =
    question.type === "SHORT_TEXT" || question.type === "LONG_TEXT";

  const savingManual = savingKey === `manual-${question.id}`;
  const savingAi = savingKey === `ai-${question.id}`;

  const graded = isQuestionGraded(question);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            {question.statement}{" "}
            <span className="font-normal text-muted-foreground">
              ({question.points} pt{question.points > 1 ? "s" : ""})
            </span>
          </CardTitle>

          <span
            className={[
              "flex shrink-0 items-center gap-1 text-xs font-medium",
              graded ? "text-emerald-600" : "text-muted-foreground",
            ].join(" ")}
          >
            {graded && <Check className="size-3.5" />}
            {graded ? "Noté" : "Non noté"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {question.type === "QCM" && (
          <div className="space-y-1.5 text-sm">
            {question.choices.map((choice) => {
              const isChosen = question.answer?.textAnswer === choice.id;

              return (
                <div
                  key={choice.id}
                  className={[
                    "rounded-lg border px-3 py-2",
                    choice.correct
                      ? "border-emerald-300 bg-emerald-50"
                      : "",
                    isChosen && !choice.correct
                      ? "border-destructive/50 bg-destructive/5"
                      : "",
                  ].join(" ")}
                >
                  {choice.text}
                  {isChosen && " · réponse de l'étudiant"}
                  {choice.correct && " · bonne réponse"}
                </div>
              );
            })}
          </div>
        )}

        {isTextQuestion && (
          <div className="space-y-2">
            {question.correctAnswer && (
              <p className="text-xs text-muted-foreground">
                Réponse attendue : {question.correctAnswer}
              </p>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              {question.answer?.textAnswer || (
                <span className="text-muted-foreground">
                  Aucune réponse donnée.
                </span>
              )}
            </div>
          </div>
        )}

        {question.type === "FILE_UPLOAD" && (
          <div>
            {question.answer?.filePath ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);

                  try {
                    await downloadAnswerFile(
                      attemptId,
                      question.id,
                      question.answer.fileName
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
              >
                <Download className="size-4" />
                {downloading ? "Téléchargement..." : "Télécharger le fichier"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun fichier envoyé.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[120px_1fr] sm:items-start">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Note / {question.points}
            </label>

            <Input
              type="number"
              min="0"
              max={question.points}
              value={score}
              onChange={(event) => setScore(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Commentaire (optionnel)
            </label>

            <Textarea
              rows={2}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {isTextQuestion && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingAi || savingManual}
              onClick={() => onAiGrade(question.id)}
            >
              <Sparkles className="size-4" />
              {savingAi ? "Correction IA..." : "Corriger avec l’IA"}
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            disabled={savingManual || savingAi}
            onClick={() =>
              onManualGrade(question.id, { score, feedback })
            }
          >
            {savingManual ? "Enregistrement..." : "Enregistrer la note"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AttemptReview() {
  const { id, attemptId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);

  async function loadReview() {
    try {
      setLoading(true);
      setError("");

      const payload = await reviewAttempt(attemptId);

      setData(payload);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible de charger cette tentative."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReview();
  }, [attemptId]);

  async function handleManualGrade(questionId, { score, feedback }) {
    setSavingKey(`manual-${questionId}`);
    setError("");

    try {
      const payload = await gradeAnswer(attemptId, questionId, {
        score,
        feedback,
      });

      setData(payload);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible d’enregistrer la note."
      );
    } finally {
      setSavingKey("");
    }
  }

  async function handleAiGrade(questionId) {
    setSavingKey(`ai-${questionId}`);
    setError("");

    try {
      const payload = await gradeAnswerWithAi(attemptId, questionId);

      setData(payload);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible de corriger cette réponse avec l’IA."
      );
    } finally {
      setSavingKey("");
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setError("");

    try {
      const payload = await publishResults(attemptId);

      setData(payload);
      setConfirmPublishOpen(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible de publier les résultats."
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="mx-auto mt-10 max-w-xl p-8">
        <h2 className="text-xl font-bold text-destructive">
          Une erreur est survenue
        </h2>
        <p className="mt-4">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const maxScore = data.questions.reduce(
    (sum, question) => sum + question.points,
    0
  );

  const gradedCount = data.questions.filter(isQuestionGraded).length;
  const totalCount = data.questions.length;
  const ungradedCount = totalCount - gradedCount;

  return (
    <div className="space-y-6">
      <Link
        to={`/evaluations/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour à l’évaluation
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {data.student.firstName} {data.student.lastName}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {data.student.email} · Soumis le{" "}
            {formatDate(data.attempt.submittedAt)}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {gradedCount}/{totalCount} question
            {totalCount > 1 ? "s" : ""} notée{gradedCount > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-lg font-semibold">
            {data.attempt.score ?? 0} / {maxScore}
          </p>

          <Button
            type="button"
            disabled={data.attempt.resultsPublished}
            onClick={() => setConfirmPublishOpen(true)}
          >
            {data.attempt.resultsPublished
              ? "Résultats publiés"
              : "Publier les résultats"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-4">
        {data.questions.map((question) => (
          <QuestionReview
            key={question.id}
            attemptId={attemptId}
            question={question}
            savingKey={savingKey}
            onManualGrade={handleManualGrade}
            onAiGrade={handleAiGrade}
          />
        ))}
      </div>

      <Dialog
        open={confirmPublishOpen}
        onOpenChange={(open) => {
          if (!publishing) {
            setConfirmPublishOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publier les résultats ?</DialogTitle>

            <DialogDescription>
              {ungradedCount > 0 ? (
                <>
                  <strong className="text-foreground">
                    {ungradedCount} question{ungradedCount > 1 ? "s" : ""}
                  </strong>{" "}
                  ne {ungradedCount > 1 ? "sont" : "st"} pas encore notée
                  {ungradedCount > 1 ? "s" : ""}. L’étudiant recevra un
                  email avec la note actuelle (
                  {data.attempt.score ?? 0} / {maxScore}).
                </>
              ) : (
                <>
                  L’étudiant recevra immédiatement un email avec sa note
                  finale ({data.attempt.score ?? 0} / {maxScore}).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={publishing}
              onClick={() => setConfirmPublishOpen(false)}
            >
              Annuler
            </Button>

            <Button type="button" disabled={publishing} onClick={handlePublish}>
              {publishing ? "Publication..." : "Confirmer la publication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
