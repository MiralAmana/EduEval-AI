import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  activatePublication,
  closePublication,
  createPublication,
  deactivatePublication,
  deletePublication,
  getPublications,
  regenerateAccessCode,
  reopenPublication,
  updatePublication,
} from "@/features/publications/api/publicationApi";

import ConfirmDialog from "@/features/publications/components/ConfirmDialog";
import PublicationCard from "@/features/publications/components/PublicationCard";
import PublicationFormModal from "@/features/publications/components/PublicationFormModal";

function normalizePublicationsResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.publications)) {
    return response.publications;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.publications)) {
    return response.data.publications;
  }

  return [];
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Une erreur inattendue est survenue."
  );
}

export default function PublicationsTab({
  evaluation,
  reloadEvaluation,
}) {
  const evaluationId = evaluation?.id;

  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] =
    useState(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [selectedPublication, setSelectedPublication] =
    useState(null);

  const [deleteDialogOpen, setDeleteDialogOpen] =
    useState(false);

  const [publicationToDelete, setPublicationToDelete] =
    useState(null);

  const loadPublications = useCallback(async () => {
    if (!evaluationId) {
      setPublications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await getPublications(
        evaluationId
      );

      setPublications(
        normalizePublicationsResponse(response)
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    loadPublications();
  }, [loadPublications]);

  function displaySuccess(message) {
    setSuccessMessage(message);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);
  }

  function openCreateModal() {
    setSelectedPublication(null);
    setFormOpen(true);
  }

  function openEditModal(publication) {
    setSelectedPublication(publication);
    setFormOpen(true);
  }

  function openDeleteDialog(publication) {
    setPublicationToDelete(publication);
    setDeleteDialogOpen(true);
  }

  async function refreshEverything() {
    await loadPublications();
    await reloadEvaluation?.();
  }

  async function handleSavePublication(payload) {
    try {
      const loadingKey =
        selectedPublication?.id || "create";

      setActionLoadingId(loadingKey);
      setError("");

      if (selectedPublication?.id) {
        await updatePublication(
          selectedPublication.id,
          payload
        );

        displaySuccess(
          "La publication a été modifiée."
        );
      } else {
        await createPublication(
          evaluationId,
          payload
        );

        displaySuccess(
          "La publication a été créée."
        );
      }

      setFormOpen(false);
      setSelectedPublication(null);

      await refreshEverything();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeletePublication() {
    if (!publicationToDelete?.id) {
      return;
    }

    try {
      setActionLoadingId(publicationToDelete.id);
      setError("");

      await deletePublication(
        publicationToDelete.id
      );

      setDeleteDialogOpen(false);
      setPublicationToDelete(null);

      displaySuccess(
        "La publication a été supprimée."
      );

      await refreshEverything();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function executeAction(
    publication,
    action,
    successText
  ) {
    if (!publication?.id) {
      return;
    }

    try {
      setActionLoadingId(publication.id);
      setError("");

      await action(publication.id);

      displaySuccess(successText);

      await refreshEverything();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-64 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />

            <p className="mt-3 text-sm text-muted-foreground">
              Chargement des publications...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">
            Publications
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Publie cette évaluation et contrôle l’accès des
            étudiants.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={loadPublications}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>

          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle publication
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Une erreur est survenue
            </p>

            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      {publications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Send className="h-8 w-8 text-primary" />
            </div>

            <h3 className="mt-5 text-xl font-semibold">
              Aucune publication
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Cette évaluation n’est pas encore accessible
              aux étudiants. Crée une publication pour
              générer un code d’accès.
            </p>

            <Button
              className="mt-6"
              onClick={openCreateModal}
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer une publication
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {publications.map((publication) => (
            <PublicationCard
              key={publication.id}
              publication={publication}
              loadingAction={
                actionLoadingId === publication.id
              }
              onEdit={openEditModal}
              onDelete={openDeleteDialog}
              onActivate={(item) =>
                executeAction(
                  item,
                  activatePublication,
                  "La publication est maintenant active."
                )
              }
              onDeactivate={(item) =>
                executeAction(
                  item,
                  deactivatePublication,
                  "La publication a été désactivée."
                )
              }
              onClose={(item) =>
                executeAction(
                  item,
                  closePublication,
                  "La publication a été fermée."
                )
              }
              onReopen={(item) =>
                executeAction(
                  item,
                  reopenPublication,
                  "La publication a été réouverte."
                )
              }
              onRegenerateCode={(item) =>
                executeAction(
                  item,
                  regenerateAccessCode,
                  "Un nouveau code d’accès a été généré."
                )
              }
            />
          ))}
        </div>
      )}

      <PublicationFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        publication={selectedPublication}
        loading={Boolean(actionLoadingId)}
        onSubmit={handleSavePublication}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer cette publication ?"
        description={`La publication « ${
          publicationToDelete?.title ||
          publicationToDelete?.name ||
          "sans titre"
        } » sera définitivement supprimée. Les tentatives associées peuvent également être affectées.`}
        confirmLabel="Supprimer"
        loading={
          actionLoadingId === publicationToDelete?.id
        }
        onConfirm={handleDeletePublication}
      />
    </div>
  );
}