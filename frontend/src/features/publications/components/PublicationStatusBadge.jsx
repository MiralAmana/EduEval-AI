import {
  Archive,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Lock,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Configuration visuelle des statuts.
 *
 * Le composant accepte plusieurs noms possibles afin de rester
 * compatible avec différentes réponses du backend.
 */
const STATUS_CONFIG = {
  DRAFT: {
    label: "Brouillon",
    icon: CircleDashed,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100",
  },

  SCHEDULED: {
    label: "Planifiée",
    icon: Clock3,
    className:
      "border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-100",
  },

  PENDING: {
    label: "En attente",
    icon: Clock3,
    className:
      "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
  },

  ACTIVE: {
    label: "Active",
    icon: PlayCircle,
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },

  PUBLISHED: {
    label: "Publiée",
    icon: PlayCircle,
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },

  OPEN: {
    label: "Ouverte",
    icon: PlayCircle,
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },

  PAUSED: {
    label: "En pause",
    icon: PauseCircle,
    className:
      "border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-100",
  },

  INACTIVE: {
    label: "Inactive",
    icon: PauseCircle,
    className:
      "border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-100",
  },

  DISABLED: {
    label: "Désactivée",
    icon: Lock,
    className:
      "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  },

  CLOSED: {
    label: "Fermée",
    icon: Lock,
    className:
      "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
  },

  COMPLETED: {
    label: "Terminée",
    icon: CheckCircle2,
    className:
      "border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-100",
  },

  FINISHED: {
    label: "Terminée",
    icon: CheckCircle2,
    className:
      "border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-100",
  },

  EXPIRED: {
    label: "Expirée",
    icon: XCircle,
    className:
      "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
  },

  CANCELLED: {
    label: "Annulée",
    icon: XCircle,
    className:
      "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
  },

  CANCELED: {
    label: "Annulée",
    icon: XCircle,
    className:
      "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
  },

  ARCHIVED: {
    label: "Archivée",
    icon: Archive,
    className:
      "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  },
};

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .toUpperCase();
}

function getStatusConfig(status) {
  const normalizedStatus = normalizeStatus(status);

  return (
    STATUS_CONFIG[normalizedStatus] || {
      label: status || "Statut inconnu",
      icon: CircleDashed,
      className:
        "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100",
    }
  );
}

/**
 * Badge réutilisable pour les statuts de publication.
 *
 * Exemple :
 *
 * <PublicationStatusBadge status="ACTIVE" />
 *
 * Avec icône masquée :
 *
 * <PublicationStatusBadge
 *   status="CLOSED"
 *   showIcon={false}
 * />
 */
export default function PublicationStatusBadge({
  status,
  showIcon = true,
  className = "",
}) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={[
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap",
        config.className,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" />}

      {config.label}
    </Badge>
  );
}

export {
  STATUS_CONFIG,
  getStatusConfig,
  normalizeStatus,
};