import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

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

function createEmptyQuestion() {
  return {
    id: crypto.randomUUID(),
    type: "SHORT_TEXT",
    statement: "",
    correctAnswer: "",
    points: 1,
    choices: ["", "", "", ""],
  };
}

export default function ManualCreate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const contentType = searchParams.get("contentType") || "EVALUATION";

  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: 60,
    instructions: "",
  });

  const [questions, setQuestions] = useState([createEmptyQuestion()]);
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

  function addQuestion() {
    setQuestions((current) => [...current, createEmptyQuestion()]);
  }

  function removeQuestion(questionId) {
    setQuestions((current) =>
      current.filter((question) => question.id !== questionId)
    );
  }

  function updateQuestion(questionId, field, value) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              [field]: value,
            }
          : question
      )
    );
  }

  function updateChoice(questionId, choiceIndex, value) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const updatedChoices = [...question.choices];
        updatedChoices[choiceIndex] = value;

        return {
          ...question,
          choices: updatedChoices,
        };
      })
    );
  }

  async function handleCreate(status) {
    setError("");
    setSaving(true);

    try {
      const evaluation = await createEvaluation({
        contentType,
        ...form,
        status,
        duration: Number(form.duration),
        questions: questions.map(({ id, ...question }) => ({
          ...question,
          points: Number(question.points),
        })),
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
      className="mx-auto max-w-5xl space-y-6"
    >
      <div>
        <p className="text-sm font-medium text-primary">
          {contentType === "EXERCISE" ? "Exercice" : "Évaluation"}
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Création manuelle
        </h1>

        <p className="mt-2 text-muted-foreground">
          Ajoutez les informations générales et les questions.
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
            <label className="text-sm font-medium">Titre</label>

            <Input
              required
              name="title"
              value={form.title}
              onChange={updateForm}
              placeholder="Ex. Algorithmique — Structures conditionnelles"
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

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Instructions pour les participants
            </label>

            <Textarea
              name="instructions"
              value={form.instructions}
              onChange={updateForm}
              placeholder="Présentez les règles et les consignes..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Questions</CardTitle>

          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        </CardHeader>

        <CardContent className="space-y-5">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="space-y-5 rounded-xl border p-5"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">Question {index + 1}</p>

                {questions.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeQuestion(question.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type de question
                </label>

                <select
                  value={question.type}
                  onChange={(event) =>
                    updateQuestion(
                      question.id,
                      "type",
                      event.target.value
                    )
                  }
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="QCM">QCM</option>
                  <option value="SHORT_TEXT">Réponse courte</option>
                  <option value="LONG_TEXT">Réponse longue</option>
                  <option value="FILE_UPLOAD">Fichier à téléverser</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Énoncé</label>

                <Textarea
                  required
                  value={question.statement}
                  onChange={(event) =>
                    updateQuestion(
                      question.id,
                      "statement",
                      event.target.value
                    )
                  }
                  placeholder="Écrivez la question..."
                />
              </div>

              {question.type === "QCM" && (
                <div className="grid gap-3 md:grid-cols-2">
                  {question.choices.map((choice, choiceIndex) => (
                    <Input
                      key={choiceIndex}
                      value={choice}
                      onChange={(event) =>
                        updateChoice(
                          question.id,
                          choiceIndex,
                          event.target.value
                        )
                      }
                      placeholder={`Choix ${choiceIndex + 1}`}
                    />
                  ))}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-[1fr_130px]">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Bonne réponse ou corrigé
                  </label>

                  <Input
                    value={question.correctAnswer}
                    onChange={(event) =>
                      updateQuestion(
                        question.id,
                        "correctAnswer",
                        event.target.value
                      )
                    }
                    placeholder="Réponse attendue"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Points</label>

                  <Input
                    type="number"
                    min="0"
                    value={question.points}
                    onChange={(event) =>
                      updateQuestion(
                        question.id,
                        "points",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
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
