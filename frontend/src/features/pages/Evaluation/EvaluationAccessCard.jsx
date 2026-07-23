import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPublication,
  regenerateAccessCode,
} from "@/features/publications/api/publicationApi";

const statusLabels = {
  IN_PROGRESS: "En cours",
  SUBMITTED: "Soumis",
  BLOCKED: "Bloqué",
  EXPIRED: "Expiré",
};

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

export default function EvaluationAccessCard({
  evaluation,
  onEvaluationChange,
}) {
  const publication = evaluation.publications?.[0];

  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [showAttempts, setShowAttempts] = useState(false);
  const [attempts, setAttempts] = useState(null);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [error, setError] = useState("");

  async function handleCopy() {
    if (!publication?.code) {
      return;
    }

    await navigator.clipboard.writeText(publication.code);

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    if (!publication) {
      return;
    }

    setRegenerating(true);
    setError("");

    try {
      await regenerateAccessCode(publication.id);
      setAttempts(null);
      await onEvaluationChange?.();
      setConfirmRegenerateOpen(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible de régénérer le code."
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function handleToggleAttempts() {
    const nextShow = !showAttempts;
    setShowAttempts(nextShow);

    if (nextShow && publication && !attempts) {
      setLoadingAttempts(true);
      setError("");

      try {
        const data = await getPublication(publication.id);

        setAttempts(data.attempts || []);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Impossible de charger les tentatives."
        );
      } finally {
        setLoadingAttempts(false);
      }
    }
  }

  if (!publication) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <KeyRound className="size-5 shrink-0" />
          Cette évaluation est en brouillon — active-la pour générer un
          code d’accès.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <KeyRound className="size-5 text-primary" />

            <div>
              <p className="text-xs text-muted-foreground">
                Code d’accès
              </p>

              <p className="font-mono text-xl font-bold tracking-wider">
                {publication.code}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copié" : "Copier"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={regenerating}
              onClick={() => setConfirmRegenerateOpen(true)}
            >
              <RefreshCw className="size-4" />
              Régénérer le code
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleToggleAttempts}
            >
              <Users className="size-4" />
              {showAttempts
                ? "Masquer les tentatives"
                : "Voir les tentatives"}
              {typeof publication._count?.attempts === "number" &&
                ` (${publication._count.attempts})`}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {showAttempts && (
          <div className="overflow-x-auto rounded-lg border">
            {loadingAttempts ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Chargement...
              </p>
            ) : attempts && attempts.length > 0 ? (
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">
                      Étudiant
                    </th>
                    <th className="px-3 py-2 font-medium">
                      Statut
                    </th>
                    <th className="px-3 py-2 font-medium">
                      Score
                    </th>
                    <th className="px-3 py-2 font-medium">
                      Soumis le
                    </th>
                    <th className="px-3 py-2 font-medium">
                      Correction
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {attempts.map((attempt) => (
                    <tr
                      key={attempt.id}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-3 py-3">
                        <p className="flex items-center gap-1.5 font-medium">
                          {attempt.student?.firstName}{" "}
                          {attempt.student?.lastName}
                          {attempt.resultsPublished && (
                            <CheckCircle2
                              className="size-4 shrink-0 text-emerald-600"
                              title="Corrigé et notifié à l'étudiant"
                            />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.student?.email}
                        </p>
                      </td>

                      <td className="px-3 py-3">
                        {statusLabels[attempt.status] ||
                          attempt.status}
                      </td>

                      <td className="px-3 py-3">
                        {attempt.score ?? "—"}
                      </td>

                      <td className="px-3 py-3">
                        {formatDate(attempt.submittedAt)}
                      </td>

                      <td className="px-3 py-3">
                        {attempt.status === "IN_PROGRESS" ? (
                          <span className="text-xs text-muted-foreground">
                            En cours
                          </span>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to={`/evaluations/${evaluation.id}/attempts/${attempt.id}`}
                            >
                              {attempt.resultsPublished
                                ? "Voir la correction"
                                : "Corriger"}
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Aucune tentative pour l’instant.
              </p>
            )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={confirmRegenerateOpen}
        onOpenChange={(open) => {
          if (!regenerating) {
            setConfirmRegenerateOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Régénérer le code d’accès ?</DialogTitle>

            <DialogDescription>
              L’ancien code{" "}
              <strong className="text-foreground">
                {publication.code}
              </strong>{" "}
              cessera de fonctionner immédiatement. Les étudiants qui ne
              l’ont pas encore utilisé ne pourront plus rejoindre
              l’évaluation avec.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={regenerating}
              onClick={() => setConfirmRegenerateOpen(false)}
            >
              Annuler
            </Button>

            <Button
              type="button"
              disabled={regenerating}
              onClick={handleRegenerate}
            >
              {regenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {regenerating ? "Régénération..." : "Régénérer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
