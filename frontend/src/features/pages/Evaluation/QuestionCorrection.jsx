import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CriteriaScoreInput from "./CriteriaScoreInput";
import { getQuestionAnswers } from "@/services/evaluation.service";
import {
  downloadAnswerFile,
  gradeAnswer,
  gradeAnswerWithAi,
  getAnswerFilePreview,
} from "@/services/attempt.service";

function isAnswerGraded(answer) {
  return typeof answer?.score === "number";
}

function studentLabel(student) {
  return `${student?.firstName || ""} ${student?.lastName || ""}`.trim() || "—";
}

function buildCriterionValues(answer) {
  const values = {};

  for (const entry of answer?.criterionScores || []) {
    values[entry.criterionId] = entry.pointsAwarded;
  }

  return values;
}

function StudentNavList({ answers, activeIndex, onSelect }) {
  return (
    <div className="max-h-[32rem] space-y-1 overflow-y-auto pr-1">
      {answers.map((answer, index) => {
        const graded = isAnswerGraded(answer);

        return (
          <button
            key={answer.attemptId}
            type="button"
            onClick={() => onSelect(index)}
            className={[
              "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
              index === activeIndex
                ? "border-primary bg-primary/5"
                : "hover:bg-muted",
            ].join(" ")}
          >
            <span className="truncate">{studentLabel(answer.student)}</span>

            <span
              className={[
                "flex shrink-0 items-center gap-1 text-xs font-medium",
                graded ? "text-emerald-600" : "text-muted-foreground",
              ].join(" ")}
            >
              {graded && <Check className="size-3.5" />}
              {graded ? answer.score : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function QuestionCorrection() {
  const { id: evaluationId, questionId } = useParams();

  const [data, setData] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [criterionValues, setCriterionValues] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const payload = await getQuestionAnswers(evaluationId, questionId);

        if (!cancelled) {
          setData(payload);
          setActiveIndex(0);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
              "Impossible de charger cette question."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [evaluationId, questionId]);

  const activeAnswer = data?.answers[activeIndex] || null;

  // Ne réinitialise les champs qu'au changement d'étudiant, pas à
  // chaque mise à jour locale du score/feedback après enregistrement
  // (dépendance volontairement limitée à attemptId).
  useEffect(() => {
    setScore(activeAnswer?.score ?? "");
    setFeedback(activeAnswer?.feedback || "");
    setCriterionValues(buildCriterionValues(activeAnswer));
    setPreviewOpen(false);
    setPreviewData(null);
  }, [activeAnswer?.attemptId]);

  const hasCriteria =
    Array.isArray(data?.question.criteria) && data.question.criteria.length > 0;

  const gradedCount = useMemo(
    () => (data ? data.answers.filter(isAnswerGraded).length : 0),
    [data]
  );

  function updateAnswerInPlace(attemptId, patch) {
    setData((current) => ({
      ...current,
      answers: current.answers.map((answer) =>
        answer.attemptId === attemptId ? { ...answer, ...patch } : answer
      ),
    }));
  }

  function extractAnswerFromReview(review) {
    return review.questions.find((question) => question.id === questionId)
      ?.answer;
  }

  async function handleManualGrade() {
    if (!activeAnswer) {
      return;
    }

    setSaving("manual");
    setError("");

    try {
      const review = await gradeAnswer(activeAnswer.attemptId, questionId, {
        score,
        feedback,
        criterionScores: hasCriteria
          ? data.question.criteria.map((criterion) => ({
              criterionId: criterion.id,
              pointsAwarded: Number(criterionValues[criterion.id]) || 0,
            }))
          : undefined,
      });
      const updated = extractAnswerFromReview(review);

      updateAnswerInPlace(activeAnswer.attemptId, {
        score: updated?.score ?? null,
        feedback: updated?.feedback ?? null,
        gradedBy: updated?.gradedBy ?? "TEACHER",
        criterionScores: updated?.criterionScores ?? [],
      });
      setScore(updated?.score ?? "");
      setFeedback(updated?.feedback || "");
      setCriterionValues(buildCriterionValues(updated));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible d’enregistrer la note."
      );
    } finally {
      setSaving("");
    }
  }

  async function handleAiGrade() {
    if (!activeAnswer) {
      return;
    }

    setSaving("ai");
    setError("");

    try {
      const review = await gradeAnswerWithAi(
        activeAnswer.attemptId,
        questionId
      );
      const updated = extractAnswerFromReview(review);

      updateAnswerInPlace(activeAnswer.attemptId, {
        score: updated?.score ?? null,
        feedback: updated?.feedback ?? null,
        gradedBy: updated?.gradedBy ?? "AI",
        criterionScores: updated?.criterionScores ?? [],
      });
      setScore(updated?.score ?? "");
      setFeedback(updated?.feedback || "");
      setCriterionValues(buildCriterionValues(updated));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible de corriger cette réponse avec l’IA."
      );
    } finally {
      setSaving("");
    }
  }

  function goTo(index) {
    if (!data) {
      return;
    }

    setActiveIndex(Math.max(0, Math.min(data.answers.length - 1, index)));
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

  const { question, answers } = data;
  const isTextQuestion =
    question.type === "SHORT_TEXT" || question.type === "LONG_TEXT";

  return (
    <div className="space-y-6">
      <Link
        to={`/evaluations/${evaluationId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour à l’évaluation
      </Link>

      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Correction par question
        </p>

        <h1 className="mt-1 text-2xl font-bold">{question.statement}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {question.points} pt{question.points > 1 ? "s" : ""}
          </Badge>

          <p className="text-sm text-muted-foreground">
            {gradedCount}/{answers.length} copie
            {answers.length > 1 ? "s" : ""} notée{gradedCount > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardContent className="p-3">
            <StudentNavList
              answers={answers}
              activeIndex={activeIndex}
              onSelect={goTo}
            />
          </CardContent>
        </Card>

        {activeAnswer && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {studentLabel(activeAnswer.student)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeAnswer.student.email}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={activeIndex === 0}
                    onClick={() => goTo(activeIndex - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  <span className="text-xs text-muted-foreground">
                    {activeIndex + 1} / {answers.length}
                  </span>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={activeIndex === answers.length - 1}
                    onClick={() => goTo(activeIndex + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              {question.type === "QCM" && (
                <div className="space-y-1.5 text-sm">
                  {question.choices.map((choice) => {
                    const isChosen =
                      activeAnswer.textAnswer === choice.id;

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
                    {activeAnswer.textAnswer || (
                      <span className="text-muted-foreground">
                        Aucune réponse donnée.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {question.type === "FILE_UPLOAD" && (
                <div className="space-y-3">
                  {activeAnswer.filePath ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loadingPreview}
                          onClick={async () => {
                            const next = !previewOpen;

                            setPreviewOpen(next);

                            if (next && !previewData) {
                              setLoadingPreview(true);

                              try {
                                const preview = await getAnswerFilePreview(
                                  activeAnswer.attemptId,
                                  question.id
                                );

                                setPreviewData(preview);
                              } catch {
                                setPreviewData({
                                  previewType: "unsupported",
                                });
                              } finally {
                                setLoadingPreview(false);
                              }
                            }
                          }}
                        >
                          <Eye className="size-4" />
                          {loadingPreview
                            ? "Chargement..."
                            : previewOpen
                              ? "Masquer l’aperçu"
                              : "Voir le fichier"}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={downloading}
                          onClick={async () => {
                            setDownloading(true);

                            try {
                              await downloadAnswerFile(
                                activeAnswer.attemptId,
                                question.id,
                                activeAnswer.fileName
                              );
                            } finally {
                              setDownloading(false);
                            }
                          }}
                        >
                          <Download className="size-4" />
                          {downloading
                            ? "Téléchargement..."
                            : "Télécharger le fichier"}
                        </Button>
                      </div>

                      {previewOpen && previewData && (
                        <div className="rounded-lg border p-4">
                          {previewData.previewType === "html" ? (
                            <div
                              className="max-h-[32rem] overflow-auto text-sm [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1"
                              // eslint-disable-next-line react/no-danger
                              dangerouslySetInnerHTML={{
                                __html: previewData.html,
                              }}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Aperçu non disponible pour ce format — télécharge
                              le fichier pour le consulter.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun fichier envoyé.
                    </p>
                  )}
                </div>
              )}

              {hasCriteria ? (
                <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                  <CriteriaScoreInput
                    criteria={question.criteria}
                    values={criterionValues}
                    onChange={(criterionId, value) =>
                      setCriterionValues((current) => ({
                        ...current,
                        [criterionId]: value,
                      }))
                    }
                  />

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
              ) : (
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
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {isTextQuestion && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving !== ""}
                    onClick={handleAiGrade}
                  >
                    <Sparkles className="size-4" />
                    {saving === "ai" ? "Correction IA..." : "Corriger avec l’IA"}
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  disabled={saving !== ""}
                  onClick={handleManualGrade}
                >
                  {saving === "manual"
                    ? "Enregistrement..."
                    : "Enregistrer la note"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={activeIndex === answers.length - 1}
                  onClick={() => goTo(activeIndex + 1)}
                >
                  Suivant
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
