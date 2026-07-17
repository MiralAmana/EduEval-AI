import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpenCheck,
  FilePlus2,
  LoaderCircle,
  Plus,
  RefreshCw,
} from "lucide-react";

import {
  deleteEvaluation,
  duplicateEvaluation,
  getEvaluations,
  updateEvaluationStatus,
} from "@/services/evaluation.service";

import EvaluationCard from "@/components/evaluations/EvaluationCard";
import SearchToolbar from "@/components/evaluations/SearchToolbar";
import DeleteDialog from "@/components/evaluations/DeleteDialog";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export default function Evaluations() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [deleteDialogOpen, setDeleteDialogOpen] =
    useState(false);

  const [selectedEvaluation, setSelectedEvaluation] =
    useState(null);

  async function loadEvaluations() {
    setLoading(true);
    setError("");

    try {
      const data = await getEvaluations();

      setEvaluations(
        Array.isArray(data) ? data : []
      );
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.response?.data?.message ||
          "Impossible de récupérer les évaluations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvaluations();
  }, []);

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setSuccess("");
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [success]);

  const filteredEvaluations = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return evaluations.filter((evaluation) => {
      const matchesSearch =
        normalizedSearch === "" ||
        evaluation.title
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        evaluation.code
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        evaluation.description
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" ||
        evaluation.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" ||
        evaluation.type === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    evaluations,
    search,
    statusFilter,
    typeFilter,
  ]);

  const statistics = useMemo(() => {
    return {
      total: evaluations.length,

      active: evaluations.filter(
        (evaluation) =>
          evaluation.status === "ACTIVE"
      ).length,

      draft: evaluations.filter(
        (evaluation) =>
          evaluation.status === "DRAFT"
      ).length,

      attempts: evaluations.reduce(
        (total, evaluation) =>
          total +
          Number(
            evaluation._count?.attempts || 0
          ),
        0
      ),
    };
  }, [evaluations]);

  function resetFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  }

  async function handleDuplicate(evaluation) {
    setLoadingAction(
      `duplicate-${evaluation.id}`
    );
    setError("");
    setSuccess("");

    try {
      const duplicated =
        await duplicateEvaluation(
          evaluation.id
        );

      setEvaluations((current) => [
        duplicated,
        ...current,
      ]);

      setSuccess(
        `L’évaluation « ${evaluation.title} » a été dupliquée.`
      );
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.response?.data?.message ||
          "Impossible de dupliquer cette évaluation."
      );
    } finally {
      setLoadingAction("");
    }
  }

  async function handleToggleStatus(
    evaluation
  ) {
    const nextStatus =
      evaluation.status === "ACTIVE"
        ? "DISABLED"
        : "ACTIVE";

    setLoadingAction(
      `status-${evaluation.id}`
    );
    setError("");
    setSuccess("");

    try {
      const updated =
        await updateEvaluationStatus(
          evaluation.id,
          nextStatus
        );

      setEvaluations((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      setSuccess(
        nextStatus === "ACTIVE"
          ? "L’évaluation a été activée."
          : "L’évaluation a été désactivée."
      );
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.response?.data?.message ||
          "Impossible de modifier le statut."
      );
    } finally {
      setLoadingAction("");
    }
  }

  function handleDeleteRequest(
    evaluation
  ) {
    setSelectedEvaluation(evaluation);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedEvaluation) {
      return;
    }

    setLoadingAction(
      `delete-${selectedEvaluation.id}`
    );
    setError("");
    setSuccess("");

    try {
      await deleteEvaluation(
        selectedEvaluation.id
      );

      setEvaluations((current) =>
        current.filter(
          (evaluation) =>
            evaluation.id !==
            selectedEvaluation.id
        )
      );

      setSuccess(
        "L’évaluation a été supprimée."
      );

      setDeleteDialogOpen(false);
      setSelectedEvaluation(null);
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.response?.data?.message ||
          "Impossible de supprimer cette évaluation."
      );
    } finally {
      setLoadingAction("");
    }
  }

  const statisticCards = [
    {
      label: "Évaluations",
      value: statistics.total,
      description: "Nombre total",
    },
    {
      label: "Actives",
      value: statistics.active,
      description: "Accessibles aux étudiants",
    },
    {
      label: "Brouillons",
      value: statistics.draft,
      description: "Non encore publiés",
    },
    {
      label: "Tentatives",
      value: statistics.attempts,
      description: "Toutes évaluations",
    },
  ];

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Mes évaluations
          </h1>

          <p className="mt-1 text-muted-foreground">
            Gérez vos exercices, évaluations et
            codes d’accès.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={loadEvaluations}
          >
            <RefreshCw
              className={[
                "size-4",
                loading ? "animate-spin" : "",
              ].join(" ")}
            />

            Actualiser
          </Button>

          <Button asChild>
            <Link to="/evaluations/create">
              <Plus className="size-4" />
              Nouvelle création
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statisticCards.map(
          ({ label, value, description }) => (
            <Card key={label}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  {label}
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {value}
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          )
        )}
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

          <div>
            <p className="font-medium text-destructive">
              Une erreur est survenue
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {error}
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700">
            {success}
          </p>
        </div>
      )}

      <SearchToolbar
        search={search}
        status={statusFilter}
        type={typeFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
        onReset={resetFilters}
      />

      {loading ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background">
          <LoaderCircle className="size-8 animate-spin text-primary" />

          <p className="mt-4 font-medium">
            Chargement des évaluations
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Récupération des données PostgreSQL...
          </p>
        </div>
      ) : filteredEvaluations.length > 0 ? (
        <section className="grid gap-5 xl:grid-cols-2">
          {filteredEvaluations.map(
            (evaluation) => (
              <EvaluationCard
                key={evaluation.id}
                evaluation={evaluation}
                loadingAction={loadingAction}
                onDuplicate={handleDuplicate}
                onDelete={
                  handleDeleteRequest
                }
                onToggleStatus={
                  handleToggleStatus
                }
              />
            )
          )}
        </section>
      ) : evaluations.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <BookOpenCheck className="size-7" />
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Aucune évaluation
            </h2>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Créez votre première évaluation
              manuellement, depuis un PDF ou avec
              l’intelligence artificielle.
            </p>

            <Button
              asChild
              className="mt-6"
            >
              <Link to="/evaluations/create">
                <FilePlus2 className="size-4" />
                Créer une évaluation
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <h2 className="text-lg font-semibold">
              Aucun résultat
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Aucune évaluation ne correspond à vos
              filtres.
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={resetFilters}
            >
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      )}

      <DeleteDialog
        open={deleteDialogOpen}
        evaluation={selectedEvaluation}
        loading={
          selectedEvaluation
            ? loadingAction ===
              `delete-${selectedEvaluation.id}`
            : false
        }
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);

          if (!open) {
            setSelectedEvaluation(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}