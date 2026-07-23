import {
  Activity,
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

/**
 * Convertit une valeur en nombre exploitable.
 */
function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

/**
 * Limite une valeur entre 0 et 100.
 */
function clampPercentage(value) {
  return Math.min(
    100,
    Math.max(0, toNumber(value))
  );
}

/**
 * Formate une valeur en pourcentage.
 */
function formatPercentage(value) {
  const percentage =
    clampPercentage(value);

  return `${percentage.toFixed(
    percentage % 1 === 0 ? 0 : 1
  )} %`;
}

/**
 * Formate une note.
 */
function formatScore(score, maxScore) {
  const numericScore =
    toNumber(score);

  const numericMaxScore =
    toNumber(maxScore);

  if (numericMaxScore <= 0) {
    return `${numericScore}`;
  }

  return `${numericScore.toFixed(
    numericScore % 1 === 0 ? 0 : 1
  )} / ${numericMaxScore}`;
}

/**
 * Formate une durée exprimée en secondes.
 */
function formatDurationInSeconds(value) {
  const totalSeconds =
    Math.max(0, toNumber(value));

  if (totalSeconds === 0) {
    return "0 min";
  }

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return minutes > 0
      ? `${hours} h ${minutes} min`
      : `${hours} h`;
  }

  if (minutes > 0) {
    return seconds > 0
      ? `${minutes} min ${seconds} s`
      : `${minutes} min`;
  }

  return `${seconds} s`;
}

/**
 * Calcule le total des points d'une évaluation.
 */
function getMaximumScore(evaluation) {
  const explicitMaximum =
    evaluation?.maxScore ??
    evaluation?.totalPoints ??
    evaluation?.maximumScore;

  if (explicitMaximum !== undefined) {
    return toNumber(explicitMaximum);
  }

  const questions = Array.isArray(
    evaluation?.questions
  )
    ? evaluation.questions
    : [];

  return questions.reduce(
    (total, question) =>
      total +
      toNumber(
        question?.points ??
          question?.score ??
          question?.maxScore ??
          question?.weight
      ),
    0
  );
}

/**
 * Récupère les tentatives de toutes les publications de l'évaluation.
 */
function getAttempts(evaluation) {
  if (!Array.isArray(evaluation?.publications)) {
    return [];
  }

  return evaluation.publications.flatMap(
    (publication) => publication.attempts || []
  );
}

/**
 * Récupère la note d'une tentative.
 */
function getAttemptScore(attempt) {
  return toNumber(
    attempt?.score ??
      attempt?.obtainedScore ??
      attempt?.totalScore ??
      attempt?.grade
  );
}

/**
 * Récupère le statut d'une tentative.
 */
function getAttemptStatus(attempt) {
  return String(
    attempt?.status || ""
  )
    .trim()
    .toUpperCase();
}

/**
 * Détermine si une tentative est terminée.
 */
function isAttemptCompleted(attempt) {
  const status =
    getAttemptStatus(attempt);

  return (
    status === "COMPLETED" ||
    status === "FINISHED" ||
    status === "SUBMITTED" ||
    status === "GRADED" ||
    Boolean(
      attempt?.submittedAt ||
        attempt?.completedAt ||
        attempt?.finishedAt
    )
  );
}

/**
 * Récupère la durée d'une tentative.
 */
function getAttemptDuration(attempt) {
  if (
    attempt?.durationSeconds !==
    undefined
  ) {
    return toNumber(
      attempt.durationSeconds
    );
  }

  if (
    attempt?.duration !== undefined
  ) {
    return toNumber(
      attempt.duration
    );
  }

  const startedAt =
    attempt?.startedAt ||
    attempt?.createdAt;

  const endedAt =
    attempt?.submittedAt ||
    attempt?.completedAt ||
    attempt?.finishedAt;

  if (!startedAt || !endedAt) {
    return 0;
  }

  const startDate =
    new Date(startedAt);

  const endDate =
    new Date(endedAt);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (endDate.getTime() -
        startDate.getTime()) /
        1000
    )
  );
}

/**
 * Récupère le nom d'un étudiant.
 */
function getStudentName(attempt) {
  const student =
    attempt?.student ||
    attempt?.user ||
    attempt?.candidate;

  if (!student) {
    return (
      attempt?.studentName ||
      attempt?.candidateName ||
      "Étudiant inconnu"
    );
  }

  if (typeof student === "string") {
    return student;
  }

  const fullName = [
    student.firstName,
    student.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    fullName ||
    student.name ||
    student.email ||
    "Étudiant inconnu"
  );
}

/**
 * Retourne la couleur d'une barre selon sa valeur.
 */
function getProgressClass(value) {
  const percentage =
    clampPercentage(value);

  if (percentage >= 75) {
    return "bg-emerald-500";
  }

  if (percentage >= 50) {
    return "bg-blue-500";
  }

  if (percentage >= 25) {
    return "bg-amber-500";
  }

  return "bg-red-500";
}

/**
 * Carte d'indicateur.
 */
function StatisticCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {label}
            </p>

            <p className="mt-2 text-2xl font-bold tracking-tight">
              {value}
            </p>

            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Barre de progression simple sans dépendance externe.
 */
function ProgressBar({
  value,
  label,
  secondaryLabel,
}) {
  const percentage =
    clampPercentage(value);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">
          {label}
        </span>

        <span className="text-muted-foreground">
          {secondaryLabel ||
            formatPercentage(
              percentage
            )}
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${getProgressClass(
            percentage
          )}`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Retourne le badge correspondant au résultat.
 */
function ResultBadge({
  passed,
  completed,
}) {
  if (!completed) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700"
      >
        <Clock3 className="mr-1 h-3.5 w-3.5" />

        En cours
      </Badge>
    );
  }

  if (passed) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
      >
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />

        Réussi
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-red-200 bg-red-50 text-red-700"
    >
      <XCircle className="mr-1 h-3.5 w-3.5" />

      Échoué
    </Badge>
  );
}

export default function StatisticsTab({
  evaluation,
}) {
  const attempts =
    getAttempts(evaluation);

  const maximumScore =
    getMaximumScore(evaluation);

  const passingScore =
    toNumber(
      evaluation?.passingScore ??
        evaluation?.minimumScore ??
        evaluation?.passScore ??
        maximumScore * 0.5
    );

  const completedAttempts =
    attempts.filter(
      isAttemptCompleted
    );

  const totalAttempts =
    attempts.length;

  const completedCount =
    completedAttempts.length;

  const inProgressCount =
    Math.max(
      0,
      totalAttempts -
        completedCount
    );

  const completionRate =
    totalAttempts > 0
      ? (completedCount /
          totalAttempts) *
        100
      : 0;

  const passedAttempts =
    completedAttempts.filter(
      (attempt) =>
        getAttemptScore(attempt) >=
        passingScore
    );

  const failedAttempts =
    completedAttempts.filter(
      (attempt) =>
        getAttemptScore(attempt) <
        passingScore
    );

  const passedCount =
    passedAttempts.length;

  const failedCount =
    failedAttempts.length;

  const successRate =
    completedCount > 0
      ? (passedCount /
          completedCount) *
        100
      : 0;

  const averageScore =
    completedCount > 0
      ? completedAttempts.reduce(
          (total, attempt) =>
            total +
            getAttemptScore(
              attempt
            ),
          0
        ) / completedCount
      : 0;

  const averagePercentage =
    maximumScore > 0
      ? (averageScore /
          maximumScore) *
        100
      : 0;

  const bestScore =
    completedCount > 0
      ? Math.max(
          ...completedAttempts.map(
            getAttemptScore
          )
        )
      : 0;

  const lowestScore =
    completedCount > 0
      ? Math.min(
          ...completedAttempts.map(
            getAttemptScore
          )
        )
      : 0;

  const totalDuration =
    completedAttempts.reduce(
      (total, attempt) =>
        total +
        getAttemptDuration(
          attempt
        ),
      0
    );

  const averageDuration =
    completedCount > 0
      ? totalDuration /
        completedCount
      : 0;

  const sortedAttempts = [
    ...attempts,
  ].sort((attemptA, attemptB) => {
    return (
      getAttemptScore(attemptB) -
      getAttemptScore(attemptA)
    );
  });

  if (totalAttempts === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>

          <h2 className="mt-5 text-xl font-semibold">
            Aucune statistique
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Aucune tentative n’a encore été
            enregistrée pour cette
            évaluation. Les résultats
            apparaîtront ici après les
            premières participations des
            étudiants.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Indicateurs principaux */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatisticCard
          icon={Users}
          label="Participations"
          value={totalAttempts}
          description="Nombre total de tentatives"
        />

        <StatisticCard
          icon={FileCheck2}
          label="Terminées"
          value={completedCount}
          description={`${inProgressCount} tentative${
            inProgressCount > 1
              ? "s"
              : ""
          } en cours`}
        />

        <StatisticCard
          icon={Target}
          label="Taux de réussite"
          value={formatPercentage(
            successRate
          )}
          description={`${passedCount} réussite${
            passedCount > 1
              ? "s"
              : ""
          }`}
        />

        <StatisticCard
          icon={TrendingUp}
          label="Moyenne"
          value={formatScore(
            averageScore,
            maximumScore
          )}
          description={formatPercentage(
            averagePercentage
          )}
        />
      </div>

      {/* Progression */}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />

              Participation
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <ProgressBar
              label="Tentatives terminées"
              value={completionRate}
              secondaryLabel={`${completedCount} sur ${totalAttempts}`}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">
                  Terminées
                </p>

                <p className="mt-1 text-xl font-bold">
                  {completedCount}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">
                  En cours
                </p>

                <p className="mt-1 text-xl font-bold">
                  {inProgressCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-primary" />

              Résultats
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <ProgressBar
              label="Taux de réussite"
              value={successRate}
              secondaryLabel={`${passedCount} sur ${completedCount}`}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-700">
                  Réussites
                </p>

                <p className="mt-1 text-xl font-bold text-emerald-800">
                  {passedCount}
                </p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">
                  Échecs
                </p>

                <p className="mt-1 text-xl font-bold text-red-800">
                  {failedCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Résumé des notes */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />

            Résumé des performances
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Meilleure note
              </p>

              <p className="mt-2 text-lg font-bold">
                {formatScore(
                  bestScore,
                  maximumScore
                )}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Note la plus basse
              </p>

              <p className="mt-2 text-lg font-bold">
                {formatScore(
                  lowestScore,
                  maximumScore
                )}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Seuil de réussite
              </p>

              <p className="mt-2 text-lg font-bold">
                {formatScore(
                  passingScore,
                  maximumScore
                )}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Durée moyenne
              </p>

              <p className="mt-2 text-lg font-bold">
                {formatDurationInSeconds(
                  averageDuration
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des participants */}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                Résultats des participants
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Classement des tentatives
                par note obtenue.
              </p>
            </div>

            <Badge variant="secondary">
              {totalAttempts} tentative
              {totalAttempts > 1
                ? "s"
                : ""}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-3 py-3 font-medium">
                    Rang
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Étudiant
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Note
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Pourcentage
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Durée
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Résultat
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedAttempts.map(
                  (attempt, index) => {
                    const score =
                      getAttemptScore(
                        attempt
                      );

                    const percentage =
                      maximumScore > 0
                        ? (score /
                            maximumScore) *
                          100
                        : 0;

                    const completed =
                      isAttemptCompleted(
                        attempt
                      );

                    const passed =
                      completed &&
                      score >=
                        passingScore;

                    return (
                      <tr
                        key={
                          attempt?.id ||
                          `attempt-${index}`
                        }
                        className="border-b last:border-b-0"
                      >
                        <td className="px-3 py-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                            {index + 1}
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <p className="font-medium">
                            {getStudentName(
                              attempt
                            )}
                          </p>

                          {attempt
                            ?.student
                            ?.email && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {
                                attempt
                                  .student
                                  .email
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-4 font-semibold">
                          {completed
                            ? formatScore(
                                score,
                                maximumScore
                              )
                            : "—"}
                        </td>

                        <td className="px-3 py-4">
                          {completed ? (
                            <div className="w-32">
                              <ProgressBar
                                value={
                                  percentage
                                }
                                label=""
                                secondaryLabel={formatPercentage(
                                  percentage
                                )}
                              />
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-3 py-4 text-sm">
                          {formatDurationInSeconds(
                            getAttemptDuration(
                              attempt
                            )
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <ResultBadge
                            completed={
                              completed
                            }
                            passed={
                              passed
                            }
                          />
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}