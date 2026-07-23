import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  Clock3,
  Loader2,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  getAttempt,
  registerExit,
  saveAnswer,
  saveFileAnswer,
  submitAttempt,
} from "@/services/attempt.service";

const QUESTION_POINTS_LABEL = (points) =>
  `${points} point${points > 1 ? "s" : ""}`;

const LOW_TIME_THRESHOLD_SECONDS = 5 * 60;

function isQuestionAnswered(question) {
  return Boolean(
    question.answer?.textAnswer?.trim() || question.answer?.filePath
  );
}

function SaveStatus({ saving, answered }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Enregistrement...
      </span>
    );
  }

  if (answered) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="size-3.5" />
        Enregistré
      </span>
    );
  }

  return null;
}

function QuestionCard({ number, question, saving, onChangeText, onChangeFile }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            Question {number} — {QUESTION_POINTS_LABEL(question.points)}
          </CardTitle>

          <SaveStatus saving={saving} answered={isQuestionAnswered(question)} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p>{question.statement}</p>

        {question.type === "QCM" && (
          <div className="space-y-2">
            {question.choices.map((choice) => (
              <label
                key={choice.id}
                className={[
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition hover:bg-muted",
                  question.answer?.textAnswer === choice.id
                    ? "border-primary bg-primary/5"
                    : "",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={choice.id}
                  checked={question.answer?.textAnswer === choice.id}
                  onChange={() => onChangeText(choice.id)}
                />
                {choice.text}
              </label>
            ))}
          </div>
        )}

        {question.type === "SHORT_TEXT" && (
          <Input
            defaultValue={question.answer?.textAnswer || ""}
            onBlur={(event) => onChangeText(event.target.value)}
          />
        )}

        {question.type === "LONG_TEXT" && (
          <Textarea
            rows={5}
            placeholder="Écrivez votre réponse ici..."
            defaultValue={question.answer?.textAnswer || ""}
            onBlur={(event) => onChangeText(event.target.value)}
          />
        )}

        {question.type === "FILE_UPLOAD" && (
          <div className="space-y-1">
            <input
              type="file"
              onChange={(event) => onChangeFile(event.target.files?.[0])}
            />
            {question.answer?.filePath && (
              <p className="text-xs text-muted-foreground">
                Un fichier a déjà été envoyé pour cette question.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TakeEvaluation() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const loadAttempt = useCallback(async () => {
    try {
      const payload = await getAttempt(attemptId);

      setData(payload);
    } catch (loadError) {
      setError(
        loadError.response?.data?.message ||
          "Impossible de charger cette évaluation."
      );
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  const isInProgress = data?.attempt.status === "IN_PROGRESS";

  useEffect(() => {
    if (!isInProgress) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [isInProgress]);

  const secondsRemaining = useMemo(() => {
    if (!data) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor((new Date(data.attempt.endsAt).getTime() - now) / 1000)
    );
  }, [data, now]);

  const handleSubmit = useCallback(async () => {
    setConfirmSubmitOpen(false);
    setSubmitting(true);

    try {
      const payload = await submitAttempt(attemptId);

      setData(payload);
    } catch (submitError) {
      if (!handleUnavailable(submitError)) {
        setError(
          submitError.response?.data?.message ||
            "Impossible de soumettre l’évaluation."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (isInProgress && secondsRemaining === 0 && !submitting) {
      handleSubmit();
    }
  }, [isInProgress, secondsRemaining, submitting, handleSubmit]);

  // Une évaluation désactivée pendant qu'un étudiant compose doit
  // le bloquer immédiatement, pas seulement empêcher les nouveaux
  // rejoins.
  function handleUnavailable(err) {
    if (err.response?.status !== 403) {
      return false;
    }

    setData(null);
    setError(
      err.response?.data?.message ||
        "Cette évaluation n’est plus disponible."
    );

    return true;
  }

  useEffect(() => {
    if (!isInProgress) {
      return undefined;
    }

    async function handleVisibilityChange() {
      if (document.hidden) {
        try {
          const payload = await registerExit(attemptId);

          setData(payload);
        } catch (exitError) {
          handleUnavailable(exitError);
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [isInProgress, attemptId]);

  async function handleChangeText(questionId, textAnswer) {
    setSavingId(questionId);

    try {
      const payload = await saveAnswer(attemptId, questionId, textAnswer);

      setData(payload);
    } catch (saveError) {
      if (!handleUnavailable(saveError)) {
        setError(
          saveError.response?.data?.message ||
            "Impossible d’enregistrer la réponse."
        );
      }
    } finally {
      setSavingId((current) => (current === questionId ? null : current));
    }
  }

  async function handleChangeFile(questionId, file) {
    if (!file) {
      return;
    }

    setSavingId(questionId);

    try {
      const payload = await saveFileAnswer(attemptId, questionId, file);

      setData(payload);
    } catch (saveError) {
      if (!handleUnavailable(saveError)) {
        setError(
          saveError.response?.data?.message ||
            "Impossible d’envoyer le fichier."
        );
      }
    } finally {
      setSavingId((current) => (current === questionId ? null : current));
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-7" />
            </div>

            <h1 className="text-2xl font-bold">Accès impossible</h1>
            <p className="mt-3 text-muted-foreground">{error}</p>

            <Button className="mt-6" onClick={() => navigate("/access")}>
              Retour
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (data.attempt.status === "BLOCKED") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-7" />
            </div>

            <h1 className="text-2xl font-bold">Évaluation bloquée</h1>

            <p className="mt-3 text-muted-foreground">
              Vous avez quitté la fenêtre de l’évaluation trois fois. Cette
              tentative ne peut plus être reprise.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (data.attempt.status !== "IN_PROGRESS") {
    const maxScore = data.questions.reduce(
      (sum, question) => sum + question.points,
      0
    );

    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="size-7" />
            </div>

            <h1 className="text-2xl font-bold">Évaluation soumise</h1>

            <p className="mt-3 text-muted-foreground">
              Merci, vos réponses ont bien été enregistrées.
            </p>

            {data.attempt.resultsPublished ? (
              <p className="mt-4 text-lg font-semibold">
                Score : {data.attempt.score} / {maxScore}
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Votre note sera disponible une fois la correction
                effectuée par l’enseignant.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const isLowTime = secondsRemaining <= LOW_TIME_THRESHOLD_SECONDS;
  const answeredCount = data.questions.filter(isQuestionAnswered).length;
  const totalQuestions = data.questions.length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-semibold">{data.evaluation.title}</p>
            <p className="text-xs text-muted-foreground">
              {answeredCount}/{totalQuestions} question
              {totalQuestions > 1 ? "s" : ""} répondue
              {answeredCount > 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={
                data.attempt.exitCount >= 2 ? "destructive" : "secondary"
              }
            >
              Sorties : {data.attempt.exitCount}/3
            </Badge>

            <div
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-semibold transition-colors",
                isLowTime
                  ? "animate-pulse border-destructive/50 bg-destructive/10 text-destructive"
                  : "",
              ].join(" ")}
            >
              <Clock3 className="size-4" />
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </div>
          </div>
        </div>

        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width:
                totalQuestions > 0
                  ? `${(answeredCount / totalQuestions) * 100}%`
                  : "0%",
            }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-6 py-10">
        {data.evaluation.instructions && (
          <p className="text-sm text-muted-foreground">
            {data.evaluation.instructions}
          </p>
        )}

        {data.attempt.exitCount > 0 && (
          <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />

            <div>
              <p className="font-semibold">Attention</p>
              <p className="text-muted-foreground">
                Tout changement d’onglet est enregistré. À la troisième
                sortie, votre tentative sera définitivement bloquée.
              </p>
            </div>
          </div>
        )}

        {data.questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            number={index + 1}
            question={question}
            saving={savingId === question.id}
            onChangeText={(value) => handleChangeText(question.id, value)}
            onChangeFile={(file) => handleChangeFile(question.id, file)}
          />
        ))}

        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={() => setConfirmSubmitOpen(true)}
            disabled={submitting}
          >
            {submitting ? "Envoi..." : "Soumettre l’évaluation"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soumettre l’évaluation ?</DialogTitle>

            <DialogDescription>
              {unansweredCount > 0 ? (
                <>
                  Il vous reste{" "}
                  <strong className="text-foreground">
                    {unansweredCount} question
                    {unansweredCount > 1 ? "s" : ""}
                  </strong>{" "}
                  sans réponse. Une fois soumise, vous ne pourrez plus
                  modifier vos réponses.
                </>
              ) : (
                "Une fois soumise, vous ne pourrez plus modifier vos réponses."
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSubmitOpen(false)}
            >
              Continuer à répondre
            </Button>

            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Envoi..." : "Confirmer la soumission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default TakeEvaluation;
