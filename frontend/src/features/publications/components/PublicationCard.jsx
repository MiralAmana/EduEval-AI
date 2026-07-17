import {
  CalendarDays,
  Clock3,
  Copy,
  Edit3,
  KeyRound,
  Lock,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  RefreshCw,
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

import PublicationStatusBadge, {
  normalizeStatus,
} from "./PublicationStatusBadge";

function formatDate(value) {
  if (!value) {
    return "Non définie";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(value) {
  const minutes = Number(value);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "Non limitée";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes
    ? `${hours} h ${remainingMinutes} min`
    : `${hours} h`;
}

function getParticipantsCount(publication) {
  if (Array.isArray(publication?.attempts)) {
    return publication.attempts.length;
  }

  if (Array.isArray(publication?.participants)) {
    return publication.participants.length;
  }

  return (
    publication?._count?.attempts ??
    publication?._count?.participants ??
    publication?.participantsCount ??
    publication?.attemptsCount ??
    0
  );
}

export default function PublicationCard({
  publication,
  loadingAction = false,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onClose,
  onReopen,
  onRegenerateCode,
}) {
  const status = normalizeStatus(publication?.status);

  const canActivate = [
    "DRAFT",
    "INACTIVE",
    "DISABLED",
    "PAUSED",
    "SCHEDULED",
  ].includes(status);

  const canDeactivate = [
    "ACTIVE",
    "OPEN",
    "PUBLISHED",
  ].includes(status);

  const canClose = [
    "ACTIVE",
    "OPEN",
    "PUBLISHED",
    "PAUSED",
    "INACTIVE",
  ].includes(status);

  const canReopen = [
    "CLOSED",
    "COMPLETED",
    "FINISHED",
    "EXPIRED",
  ].includes(status);

  const duration =
    publication?.duration ??
    publication?.durationMinutes ??
    publication?.timeLimit;

  const startDate =
    publication?.startDate ??
    publication?.startsAt ??
    publication?.availableFrom;

  const endDate =
    publication?.endDate ??
    publication?.endsAt ??
    publication?.availableUntil;

  const accessCode =
    publication?.accessCode ??
    publication?.code ??
    publication?.joinCode;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <PublicationStatusBadge
              status={publication?.status}
            />

            <CardTitle className="mt-3 line-clamp-2 text-lg">
              {publication?.title ||
                publication?.name ||
                "Publication sans titre"}
            </CardTitle>

            {publication?.description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {publication.description}
              </p>
            )}
          </div>

          <MoreVertical className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KeyRound className="h-4 w-4" />
              Code d’accès
            </div>

            <p className="mt-1 font-mono text-base font-bold tracking-wider">
              {accessCode || "Non généré"}
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Durée
            </div>

            <p className="mt-1 font-semibold">
              {formatDuration(duration)}
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              Participants
            </div>

            <p className="mt-1 font-semibold">
              {getParticipantsCount(publication)}
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Copy className="h-4 w-4" />
              Tentatives
            </div>

            <p className="mt-1 font-semibold">
              {publication?.maxAttempts ??
                publication?.attemptLimit ??
                1}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />

            <div>
              <p className="text-xs text-muted-foreground">
                Ouverture
              </p>

              <p className="text-sm font-medium">
                {formatDate(startDate)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 text-primary" />

            <div>
              <p className="text-xs text-muted-foreground">
                Fermeture
              </p>

              <p className="text-sm font-medium">
                {formatDate(endDate)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {publication?.shuffleQuestions && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
              Questions mélangées
            </span>
          )}

          {publication?.showResults && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
              Résultats visibles
            </span>
          )}

          {publication?.preventTabSwitch && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
              Surveillance active
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t p-4">
        <Button
          variant="outline"
          size="sm"
          disabled={loadingAction}
          onClick={() => onEdit?.(publication)}
        >
          <Edit3 className="mr-2 h-4 w-4" />
          Modifier
        </Button>

        {canActivate && (
          <Button
            size="sm"
            disabled={loadingAction}
            onClick={() => onActivate?.(publication)}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Activer
          </Button>
        )}

        {canDeactivate && (
          <Button
            variant="outline"
            size="sm"
            disabled={loadingAction}
            onClick={() => onDeactivate?.(publication)}
          >
            <PauseCircle className="mr-2 h-4 w-4" />
            Désactiver
          </Button>
        )}

        {canClose && (
          <Button
            variant="outline"
            size="sm"
            disabled={loadingAction}
            onClick={() => onClose?.(publication)}
          >
            <Lock className="mr-2 h-4 w-4" />
            Fermer
          </Button>
        )}

        {canReopen && (
          <Button
            variant="outline"
            size="sm"
            disabled={loadingAction}
            onClick={() => onReopen?.(publication)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Réouvrir
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={loadingAction}
          onClick={() => onRegenerateCode?.(publication)}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Nouveau code
        </Button>

        <Button
          variant="destructive"
          size="sm"
          disabled={loadingAction}
          onClick={() => onDelete?.(publication)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer
        </Button>
      </CardFooter>
    </Card>
  );
}