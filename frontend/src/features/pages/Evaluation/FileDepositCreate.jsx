import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createEvaluation } from "@/services/evaluation.service";

const depositTypeOptions = [
  { value: "WORD", label: "Word" },
  { value: "EXCEL", label: "Excel" },
  { value: "POWERPOINT", label: "PowerPoint" },
];

export default function FileDepositCreate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const contentType = searchParams.get("contentType") || "EVALUATION";

  const [form, setForm] = useState({
    depositType: "WORD",
    title: "",
    description: "",
    duration: 60,
    statement: "Déposez votre fichier ci-dessous.",
    points: 20,
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleCreate(status) {
    setError("");
    setSaving(true);

    try {
      const evaluation = await createEvaluation({
        contentType,
        title: form.title,
        description: form.description,
        duration: Number(form.duration),
        type: form.depositType,
        status,
        questions: [
          {
            type: "FILE_UPLOAD",
            statement: form.statement,
            points: Number(form.points),
          },
        ],
      });

      const accessCode = evaluation.publications?.[0]?.code;

      setSuccess(
        accessCode
          ? `Évaluation créée et publiée avec succès. Code d’accès : ${accessCode}`
          : "Évaluation créée avec succès."
      );

      window.setTimeout(() => {
        navigate(`/evaluations/${evaluation.id}`);
      }, 1200);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible d’enregistrer l’évaluation."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    handleCreate("ACTIVE");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <p className="text-sm font-medium text-primary">
          {contentType === "EXERCISE" ? "Exercice" : "Évaluation"}
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Dépôt de fichier
        </h1>

        <p className="mt-2 text-muted-foreground">
          L’élève accède avec le code, dépose son fichier — sans plein écran
          ni suivi anti-triche. Seul le format du fichier est vérifié.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <p className="font-medium text-green-700">{success}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Type de dépôt</label>

            <select
              name="depositType"
              value={form.depositType}
              onChange={updateForm}
              className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {depositTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Titre</label>

            <Input
              required
              name="title"
              value={form.title}
              onChange={updateForm}
              placeholder="Ex. Devoir Excel — Budget familial"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Description</label>

            <Textarea
              name="description"
              value={form.description}
              onChange={updateForm}
              placeholder="Décrivez brièvement le contenu..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Durée en minutes
            </label>

            <Input
              required
              min="1"
              type="number"
              name="duration"
              value={form.duration}
              onChange={updateForm}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dépôt de fichier</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Consigne</label>

            <Textarea
              required
              name="statement"
              value={form.statement}
              onChange={updateForm}
              placeholder="Ex. Complétez le tableau ci-joint et déposez votre fichier Excel."
            />
          </div>

          <div className="max-w-40 space-y-2">
            <label className="text-sm font-medium">Points</label>

            <Input
              type="number"
              min="0"
              name="points"
              value={form.points}
              onChange={updateForm}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => handleCreate("DRAFT")}
        >
          Enregistrer en brouillon
        </Button>

        <Button type="submit" disabled={saving}>
          {saving ? "Création..." : "Créer et activer"}
        </Button>
      </div>
    </form>
  );
}
