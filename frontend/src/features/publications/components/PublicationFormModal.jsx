import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const INITIAL_FORM = {
  title: "",
  description: "",
  duration: 60,
  maxAttempts: 1,
  startDate: "",
  endDate: "",
  shuffleQuestions: false,
  showResults: true,
  showCorrection: false,
  preventTabSwitch: false,
  maxTabSwitches: 3,
  requireEmail: true,
  requireFullName: true,
};

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
}

function buildInitialForm(publication) {
  if (!publication) {
    return INITIAL_FORM;
  }

  return {
    title:
      publication.title ??
      publication.name ??
      "",

    description:
      publication.description ?? "",

    duration:
      publication.duration ??
      publication.durationMinutes ??
      publication.timeLimit ??
      60,

    maxAttempts:
      publication.maxAttempts ??
      publication.attemptLimit ??
      1,

    startDate: toDateTimeLocal(
      publication.startDate ??
        publication.startsAt ??
        publication.availableFrom
    ),

    endDate: toDateTimeLocal(
      publication.endDate ??
        publication.endsAt ??
        publication.availableUntil
    ),

    shuffleQuestions:
      publication.shuffleQuestions ?? false,

    showResults:
      publication.showResults ?? true,

    showCorrection:
      publication.showCorrection ?? false,

    preventTabSwitch:
      publication.preventTabSwitch ?? false,

    maxTabSwitches:
      publication.maxTabSwitches ?? 3,

    requireEmail:
      publication.requireEmail ?? true,

    requireFullName:
      publication.requireFullName ?? true,
  };
}

function BooleanField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div>
        <Label
          htmlFor={id}
          className="cursor-pointer"
        >
          {label}
        </Label>

        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export default function PublicationFormModal({
  open,
  onOpenChange,
  publication = null,
  loading = false,
  onSubmit,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  const isEditing = Boolean(publication?.id);

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(publication));
      setErrors({});
    }
  }, [open, publication]);

  const modalTitle = useMemo(
    () =>
      isEditing
        ? "Modifier la publication"
        : "Créer une publication",
    [isEditing]
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: "",
    }));
  }

  function validate() {
    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = "Le titre est obligatoire.";
    }

    if (
      Number(form.duration) <= 0 ||
      !Number.isFinite(Number(form.duration))
    ) {
      nextErrors.duration =
        "La durée doit être supérieure à zéro.";
    }

    if (
      Number(form.maxAttempts) <= 0 ||
      !Number.isFinite(Number(form.maxAttempts))
    ) {
      nextErrors.maxAttempts =
        "Le nombre de tentatives doit être supérieur à zéro.";
    }

    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate) <= new Date(form.startDate)
    ) {
      nextErrors.endDate =
        "La fermeture doit être après l’ouverture.";
    }

    if (
      form.preventTabSwitch &&
      Number(form.maxTabSwitches) < 0
    ) {
      nextErrors.maxTabSwitches =
        "Le nombre de sorties autorisées est invalide.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      duration: Number(form.duration),
      maxAttempts: Number(form.maxAttempts),

      startDate: form.startDate
        ? new Date(form.startDate).toISOString()
        : null,

      endDate: form.endDate
        ? new Date(form.endDate).toISOString()
        : null,

      shuffleQuestions: Boolean(
        form.shuffleQuestions
      ),

      showResults: Boolean(form.showResults),

      showCorrection: Boolean(
        form.showCorrection
      ),

      preventTabSwitch: Boolean(
        form.preventTabSwitch
      ),

      maxTabSwitches: form.preventTabSwitch
        ? Number(form.maxTabSwitches)
        : null,

      requireEmail: Boolean(form.requireEmail),

      requireFullName: Boolean(
        form.requireFullName
      ),
    };

    await onSubmit?.(payload);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) {
          onOpenChange?.(nextOpen);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>

          <DialogDescription>
            Configure l’accès des étudiants, les dates et les
            règles de participation.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <Label htmlFor="publication-title">
              Titre
            </Label>

            <Input
              id="publication-title"
              value={form.title}
              placeholder="Examen final d’algorithmique"
              disabled={loading}
              onChange={(event) =>
                updateField("title", event.target.value)
              }
            />

            {errors.title && (
              <p className="text-sm text-destructive">
                {errors.title}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="publication-description">
              Description
            </Label>

            <Textarea
              id="publication-description"
              value={form.description}
              placeholder="Instructions destinées aux étudiants..."
              rows={4}
              disabled={loading}
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value
                )
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="publication-duration">
                Durée en minutes
              </Label>

              <Input
                id="publication-duration"
                type="number"
                min="1"
                value={form.duration}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "duration",
                    event.target.value
                  )
                }
              />

              {errors.duration && (
                <p className="text-sm text-destructive">
                  {errors.duration}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="publication-attempts">
                Nombre de tentatives
              </Label>

              <Input
                id="publication-attempts"
                type="number"
                min="1"
                value={form.maxAttempts}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "maxAttempts",
                    event.target.value
                  )
                }
              />

              {errors.maxAttempts && (
                <p className="text-sm text-destructive">
                  {errors.maxAttempts}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="publication-start">
                Date d’ouverture
              </Label>

              <Input
                id="publication-start"
                type="datetime-local"
                value={form.startDate}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "startDate",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publication-end">
                Date de fermeture
              </Label>

              <Input
                id="publication-end"
                type="datetime-local"
                value={form.endDate}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "endDate",
                    event.target.value
                  )
                }
              />

              {errors.endDate && (
                <p className="text-sm text-destructive">
                  {errors.endDate}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">
              Paramètres de l’évaluation
            </h3>

            <BooleanField
              id="shuffle-questions"
              label="Mélanger les questions"
              description="Chaque étudiant peut recevoir les questions dans un ordre différent."
              checked={form.shuffleQuestions}
              onCheckedChange={(checked) =>
                updateField(
                  "shuffleQuestions",
                  checked
                )
              }
            />

            <BooleanField
              id="show-results"
              label="Afficher la note"
              description="L’étudiant voit sa note après avoir terminé."
              checked={form.showResults}
              onCheckedChange={(checked) =>
                updateField("showResults", checked)
              }
            />

            <BooleanField
              id="show-correction"
              label="Afficher la correction"
              description="Les bonnes réponses sont affichées après la soumission."
              checked={form.showCorrection}
              onCheckedChange={(checked) =>
                updateField(
                  "showCorrection",
                  checked
                )
              }
            />

            <BooleanField
              id="require-name"
              label="Nom et prénom obligatoires"
              description="L’étudiant doit renseigner son identité avant de commencer."
              checked={form.requireFullName}
              onCheckedChange={(checked) =>
                updateField(
                  "requireFullName",
                  checked
                )
              }
            />

            <BooleanField
              id="require-email"
              label="Adresse e-mail obligatoire"
              description="L’étudiant doit renseigner une adresse e-mail."
              checked={form.requireEmail}
              onCheckedChange={(checked) =>
                updateField(
                  "requireEmail",
                  checked
                )
              }
            />

            <BooleanField
              id="prevent-tab-switch"
              label="Surveiller les sorties de fenêtre"
              description="Les changements d’onglet ou de fenêtre sont comptabilisés."
              checked={form.preventTabSwitch}
              onCheckedChange={(checked) =>
                updateField(
                  "preventTabSwitch",
                  checked
                )
              }
            />

            {form.preventTabSwitch && (
              <div className="space-y-2">
                <Label htmlFor="max-tab-switches">
                  Nombre maximal de sorties autorisées
                </Label>

                <Input
                  id="max-tab-switches"
                  type="number"
                  min="0"
                  value={form.maxTabSwitches}
                  disabled={loading}
                  onChange={(event) =>
                    updateField(
                      "maxTabSwitches",
                      event.target.value
                    )
                  }
                />

                {errors.maxTabSwitches && (
                  <p className="text-sm text-destructive">
                    {errors.maxTabSwitches}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange?.(false)}
            >
              Annuler
            </Button>

            <Button
              type="submit"
              disabled={loading}
            >
              {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {isEditing
                ? "Enregistrer"
                : "Créer la publication"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}