import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Layers3,
  UserRound,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Formate une date provenant de l'API.
 *
 * Exemples acceptés :
 * - "2026-07-17T10:30:00.000Z"
 * - "2026-07-17"
 */
function formatDate(value) {
  if (!value) {
    return "Non renseignée";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

/**
 * Transforme une durée exprimée en minutes.
 *
 * Exemples :
 * 45  -> 45 min
 * 60  -> 1 h
 * 90  -> 1 h 30 min
 */
function formatDuration(value) {
  const duration = Number(value);

  if (!duration || duration <= 0) {
    return "Non définie";
  }

  if (duration < 60) {
    return `${duration} min`;
  }

  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

/**
 * Retourne les informations visuelles du statut.
 */
function getStatusConfig(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toUpperCase();

  const statusMap = {
    DRAFT: {
      label: "Brouillon",
      className:
        "border-slate-200 bg-slate-100 text-slate-700",
    },

    PUBLISHED: {
      label: "Publiée",
      className:
        "border-blue-200 bg-blue-100 text-blue-700",
    },

    ACTIVE: {
      label: "Active",
      className:
        "border-emerald-200 bg-emerald-100 text-emerald-700",
    },

    INACTIVE: {
      label: "Inactive",
      className:
        "border-amber-200 bg-amber-100 text-amber-700",
    },

    DISABLED: {
      label: "Désactivée",
      className:
        "border-orange-200 bg-orange-100 text-orange-700",
    },

    ARCHIVED: {
      label: "Archivée",
      className:
        "border-zinc-200 bg-zinc-100 text-zinc-700",
    },

    FINISHED: {
      label: "Terminée",
      className:
        "border-violet-200 bg-violet-100 text-violet-700",
    },
  };

  return (
    statusMap[normalizedStatus] || {
      label: status || "Non défini",
      className:
        "border-slate-200 bg-slate-100 text-slate-700",
    }
  );
}

/**
 * Détermine le nombre de questions.
 *
 * Le backend peut retourner :
 * - evaluation.questions
 * - evaluation._count.questions
 * - evaluation.questionsCount
 * - evaluation.questionCount
 */
function getQuestionsCount(evaluation) {
  if (Array.isArray(evaluation?.questions)) {
    return evaluation.questions.length;
  }

  return (
    evaluation?._count?.questions ??
    evaluation?.questionsCount ??
    evaluation?.questionCount ??
    0
  );
}

/**
 * Récupère le nom de l'auteur selon différentes structures API.
 */
function getAuthorName(evaluation) {
  const author =
    evaluation?.author ||
    evaluation?.creator ||
    evaluation?.user ||
    evaluation?.createdBy;

  if (!author) {
    return "Non renseigné";
  }

  if (typeof author === "string") {
    return author;
  }

  const fullName = [
    author.firstName,
    author.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    fullName ||
    author.name ||
    author.username ||
    author.email ||
    "Non renseigné"
  );
}

/**
 * Récupère le type d'évaluation.
 */
function getEvaluationType(evaluation) {
  const type =
    evaluation?.type ||
    evaluation?.evaluationType ||
    evaluation?.category;

  if (!type) {
    return "Évaluation classique";
  }

  const normalizedType = String(type).toUpperCase();

  const typeLabels = {
    QUIZ: "Quiz",
    EXAM: "Examen",
    EXERCISE: "Exercice",
    HOMEWORK: "Devoir",
    TEST: "Test",
    PRACTICAL: "Travaux pratiques",
    ASSESSMENT: "Évaluation",
  };

  return typeLabels[normalizedType] || type;
}

/**
 * Une petite carte d'information réutilisable.
 */
function InformationCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {label}
          </p>

          <p className="mt-1 break-words text-base font-semibold">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeneralTab({ evaluation }) {
  if (!evaluation) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Les informations de l’évaluation sont
          indisponibles.
        </CardContent>
      </Card>
    );
  }

  const statusConfig = getStatusConfig(
    evaluation.status
  );

  const questionsCount =
    getQuestionsCount(evaluation);

  const title =
    evaluation.title ||
    evaluation.name ||
    "Évaluation sans titre";

  const description =
    evaluation.description?.trim() ||
    "Aucune description n’a été ajoutée pour cette évaluation.";

  const duration =
    evaluation.duration ??
    evaluation.durationMinutes ??
    evaluation.timeLimit;

  const createdAt =
    evaluation.createdAt ||
    evaluation.creationDate;

  const updatedAt =
    evaluation.updatedAt ||
    evaluation.modificationDate;

  return (
    <div className="space-y-6">
      {/* Résumé principal */}

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">
                Informations générales
              </CardTitle>

              <p className="text-sm text-muted-foreground">
                Résumé et configuration principale de
                l’évaluation.
              </p>
            </div>

            <span
              className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${statusConfig.className}`}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />

              {statusConfig.label}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Titre
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {title}
            </h2>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Description
            </p>

            <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground/90">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques rapides */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InformationCard
          icon={Clock3}
          label="Durée"
          value={formatDuration(duration)}
          description="Temps prévu pour terminer l’évaluation"
        />

        <InformationCard
          icon={FileQuestion}
          label="Questions"
          value={`${questionsCount}`}
          description="Nombre total de questions"
        />

        <InformationCard
          icon={Layers3}
          label="Type"
          value={getEvaluationType(evaluation)}
          description="Catégorie de l’évaluation"
        />

        <InformationCard
          icon={UserRound}
          label="Auteur"
          value={getAuthorName(evaluation)}
          description="Créateur de cette évaluation"
        />
      </div>

      {/* Dates */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />

            Historique
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Date de création
              </p>

              <p className="mt-2 font-semibold">
                {formatDate(createdAt)}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Dernière modification
              </p>

              <p className="mt-2 font-semibold">
                {formatDate(updatedAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résumé du contenu */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />

            Résumé du contenu
          </CardTitle>
        </CardHeader>

        <CardContent>
          {questionsCount > 0 ? (
            <div className="rounded-xl border bg-muted/30 p-5">
              <p className="font-medium">
                Cette évaluation contient{" "}
                <span className="font-bold text-primary">
                  {questionsCount}
                </span>{" "}
                question
                {questionsCount > 1 ? "s" : ""}.
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                Consulte l’onglet « Questions » pour
                afficher le contenu complet, les choix de
                réponses et les critères de correction.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <FileQuestion className="mx-auto h-10 w-10 text-muted-foreground" />

              <h3 className="mt-4 font-semibold">
                Aucune question
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Cette évaluation ne contient pas encore de
                questions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}