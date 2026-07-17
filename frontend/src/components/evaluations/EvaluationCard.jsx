import { Link } from "react-router-dom";
import {
  Clock3,
  Copy,
  Eye,
  FileQuestion,
  Layers3,
  PauseCircle,
  Pencil,
  PlayCircle,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import StatusBadge from "./StatusBadge";

const typeLabels = {
  CLASSIC: "Questions classiques",
  WORD: "Microsoft Word",
  EXCEL: "Microsoft Excel",
  POWERPOINT: "Microsoft PowerPoint",
  MIXED: "Mixte",
};

const contentTypeLabels = {
  EXERCISE: "Exercice",
  EVALUATION: "Évaluation",
};

export default function EvaluationCard({
  evaluation,
  loadingAction,
  onDuplicate,
  onDelete,
  onToggleStatus,
}) {
  const questionCount =
    evaluation._count?.questions ??
    evaluation.questions?.length ??
    0;

  const publicationCount =
    evaluation._count?.publications ??
    evaluation.publications?.length ??
    0;

  const attemptCount =
    evaluation.publications?.reduce(
      (total, publication) =>
        total + Number(publication._count?.attempts || 0),
      0
    ) ?? 0;

  const isActive = evaluation.status === "ACTIVE";

  const createdAt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(evaluation.createdAt));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">
              {evaluation.title}
            </CardTitle>

            <p className="mt-1 text-sm text-muted-foreground">
              {contentTypeLabels[evaluation.contentType] ??
                evaluation.contentType}
              {" · "}
              {typeLabels[evaluation.type] ?? evaluation.type}
            </p>
          </div>

          <StatusBadge status={evaluation.status} />
        </div>

        {evaluation.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {evaluation.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileQuestion className="size-4 text-muted-foreground" />

            <div>
              <p className="font-medium">{questionCount}</p>
              <p className="text-xs text-muted-foreground">
                question(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Layers3 className="size-4 text-muted-foreground" />

            <div>
              <p className="font-medium">{publicationCount}</p>
              <p className="text-xs text-muted-foreground">
                publication(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />

            <div>
              <p className="font-medium">{attemptCount}</p>
              <p className="text-xs text-muted-foreground">
                tentative(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />

            <div>
              <p className="font-medium">
                {evaluation.duration} min
              </p>
              <p className="text-xs text-muted-foreground">
                durée par défaut
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Créée le
          </p>

          <p className="mt-1 text-sm font-medium">
            {createdAt}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t pt-5">
        <Button asChild size="sm" variant="outline">
          <Link to={`/evaluations/${evaluation.id}`}>
            <Eye className="size-4" />
            Voir
          </Link>
        </Button>

        <Button asChild size="sm" variant="outline">
          <Link to={`/evaluations/${evaluation.id}/edit`}>
            <Pencil className="size-4" />
            Modifier
          </Link>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            loadingAction === `duplicate-${evaluation.id}`
          }
          onClick={() => onDuplicate(evaluation)}
        >
          <Copy className="size-4" />
          Dupliquer
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            loadingAction === `status-${evaluation.id}`
          }
          onClick={() => onToggleStatus(evaluation)}
        >
          {isActive ? (
            <>
              <PauseCircle className="size-4" />
              Désactiver
            </>
          ) : (
            <>
              <PlayCircle className="size-4" />
              Activer
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={
            loadingAction === `delete-${evaluation.id}`
          }
          onClick={() => onDelete(evaluation)}
        >
          <Trash2 className="size-4" />
          Supprimer
        </Button>
      </CardFooter>
    </Card>
  );
}