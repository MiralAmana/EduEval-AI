import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  getEvaluationById,
  updateEvaluation,
} from "@/services/evaluation.service";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function createEmptyQuestion() {
  return {
    id: crypto.randomUUID(),
    statement: "",
    type: "SHORT_TEXT",
    choices: [],
    correctAnswer: "",
    points: 1,
  };
}

function normalizeQuestion(question) {
  return {
    id: question.id || crypto.randomUUID(),
    statement: question.statement || "",
    type: question.type || "SHORT_TEXT",
    choices: Array.isArray(question.choices)
      ? question.choices.map((choice) =>
          typeof choice === "string" ? choice : choice.text
        )
      : [],
    correctAnswer: question.correctAnswer || "",
    points: Number(question.points) || 1,
  };
}

export default function EvaluationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    duration: 60,
    contentType: "EVALUATION",
    type: "CLASSIC",
    status: "DRAFT",
  });

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvaluation() {
      setLoading(true);
      setError("");

      try {
        const evaluation =
          await getEvaluationById(id);

        setForm({
          title: evaluation.title || "",
          description:
            evaluation.description || "",
          instructions:
            evaluation.instructions || "",
          duration:
            Number(evaluation.duration) || 60,
          contentType:
            evaluation.contentType ||
            "EVALUATION",
          type:
            evaluation.type || "CLASSIC",
          status:
            evaluation.status || "DRAFT",
        });

        setQuestions(
          Array.isArray(evaluation.questions)
            ? evaluation.questions.map(
                normalizeQuestion
              )
            : []
        );
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Impossible de charger cette évaluation."
        );
      } finally {
        setLoading(false);
      }
    }

    loadEvaluation();
  }, [id]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateQuestion(
    questionId,
    field,
    value
  ) {
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

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      createEmptyQuestion(),
    ]);
  }

  function removeQuestion(questionId) {
    setQuestions((current) =>
      current.filter(
        (question) =>
          question.id !== questionId
      )
    );
  }

  function addChoice(questionId) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              choices: [
                ...question.choices,
                "",
              ],
            }
          : question
      )
    );
  }

  function updateChoice(
    questionId,
    choiceIndex,
    value
  ) {
    setQuestions((current) =>
      current.map((question) => {
        if (
          question.id !== questionId
        ) {
          return question;
        }

        const choices = [
          ...question.choices,
        ];

        choices[choiceIndex] = value;

        return {
          ...question,
          choices,
        };
      })
    );
  }

  function removeChoice(
    questionId,
    choiceIndex
  ) {
    setQuestions((current) =>
      current.map((question) => {
        if (
          question.id !== questionId
        ) {
          return question;
        }

        return {
          ...question,
          choices:
            question.choices.filter(
              (_, index) =>
                index !== choiceIndex
            ),
        };
      })
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!form.title.trim()) {
      setError(
        "Le titre est obligatoire."
      );
      return;
    }

    if (
      Number(form.duration) <= 0
    ) {
      setError(
        "La durée doit être supérieure à zéro."
      );
      return;
    }

    const invalidQuestionIndex =
      questions.findIndex(
        (question) =>
          !question.statement.trim()
      );

    if (
      invalidQuestionIndex !== -1
    ) {
      setError(
        `L’énoncé de la question ${
          invalidQuestionIndex + 1
        } est obligatoire.`
      );
      return;
    }

    const invalidQcmIndex =
      questions.findIndex(
        (question) =>
          question.type === "QCM" &&
          question.choices
            .map((choice) =>
              choice.trim()
            )
            .filter(Boolean).length < 2
      );

    if (invalidQcmIndex !== -1) {
      setError(
        `La question ${
          invalidQcmIndex + 1
        } doit contenir au moins deux choix.`
      );
      return;
    }

    const payload = {
      title: form.title.trim(),
      description:
        form.description.trim() || null,
      instructions:
        form.instructions.trim() || null,
      duration: Number(form.duration),
      contentType: form.contentType,
      type: form.type,
      status: form.status,
      questions: questions.map(
        ({ id: questionId, ...question }) => ({
          ...question,
          statement:
            question.statement.trim(),
          choices:
            question.type === "QCM"
              ? question.choices
                  .map((choice) =>
                    choice.trim()
                  )
                  .filter(Boolean)
              : [],
          correctAnswer:
            question.correctAnswer.trim() ||
            null,
          points:
            Number(question.points) || 1,
        })
      ),
    };

    setSaving(true);

    try {
      await updateEvaluation(id, payload);

      navigate(`/evaluations/${id}`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible d’enregistrer les modifications."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-primary" />

        <p className="mt-4 font-medium">
          Chargement de l’évaluation
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-5xl space-y-7"
    >
      <Button
        asChild
        variant="ghost"
        className="-ml-3"
      >
        <Link
          to={`/evaluations/${id}`}
        >
          <ArrowLeft className="size-4" />
          Retour au détail
        </Link>
      </Button>

      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Modifier l’évaluation
          </h1>

          <p className="mt-1 text-muted-foreground">
            Modifiez les informations,
            questions et paramètres.
          </p>
        </div>

        <Button
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Enregistrement
            </>
          ) : (
            <>
              <Save className="size-4" />
              Enregistrer
            </>
          )}
        </Button>
      </section>

      {error && (
        <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

          <p className="text-sm text-destructive">
            {error}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Informations générales
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Titre
            </label>

            <Input
              name="title"
              value={form.title}
              onChange={updateForm}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Description
            </label>

            <Textarea
              name="description"
              value={form.description}
              onChange={updateForm}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Instructions
            </label>

            <Textarea
              name="instructions"
              value={form.instructions}
              onChange={updateForm}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Durée en minutes
            </label>

            <Input
              type="number"
              min="1"
              name="duration"
              value={form.duration}
              onChange={updateForm}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Type de contenu
            </label>

            <select
              name="contentType"
              value={form.contentType}
              onChange={updateForm}
              className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="EXERCISE">
                Exercice
              </option>

              <option value="EVALUATION">
                Évaluation
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Format
            </label>

            <select
              name="type"
              value={form.type}
              onChange={updateForm}
              className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="CLASSIC">
                Questions classiques
              </option>

              <option value="WORD">
                Microsoft Word
              </option>

              <option value="EXCEL">
                Microsoft Excel
              </option>

              <option value="POWERPOINT">
                Microsoft PowerPoint
              </option>

              <option value="MIXED">
                Mixte
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Statut
            </label>

            <select
              name="status"
              value={form.status}
              onChange={updateForm}
              className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="DRAFT">
                Brouillon
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="DISABLED">
                Désactivée
              </option>

              <option value="FINISHED">
                Terminée
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Questions</CardTitle>

          <Button
            type="button"
            variant="outline"
            onClick={addQuestion}
          >
            <Plus className="size-4" />
            Ajouter une question
          </Button>
        </CardHeader>

        <CardContent className="space-y-5">
          {questions.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">
                Aucune question
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Ajoutez une question pour
                compléter cette évaluation.
              </p>
            </div>
          )}

          {questions.map(
            (question, index) => (
              <div
                key={question.id}
                className="space-y-5 rounded-xl border p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <strong>
                    Question {index + 1}
                  </strong>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      removeQuestion(
                        question.id
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Type
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
                    className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    <option value="QCM">
                      QCM
                    </option>

                    <option value="SHORT_TEXT">
                      Réponse courte
                    </option>

                    <option value="LONG_TEXT">
                      Réponse longue
                    </option>

                    <option value="FILE_UPLOAD">
                      Dépôt de fichier
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Énoncé
                  </label>

                  <Textarea
                    value={
                      question.statement
                    }
                    onChange={(event) =>
                      updateQuestion(
                        question.id,
                        "statement",
                        event.target.value
                      )
                    }
                  />
                </div>

                {question.type === "QCM" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-medium">
                        Choix
                      </label>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          addChoice(question.id)
                        }
                      >
                        <Plus className="size-4" />
                        Ajouter un choix
                      </Button>
                    </div>

                    {question.choices.map(
                      (
                        choice,
                        choiceIndex
                      ) => (
                        <div
                          key={choiceIndex}
                          className="flex gap-2"
                        >
                          <Input
                            value={choice}
                            onChange={(event) =>
                              updateChoice(
                                question.id,
                                choiceIndex,
                                event.target.value
                              )
                            }
                          />

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              removeChoice(
                                question.id,
                                choiceIndex
                              )
                            }
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Bonne réponse ou
                      corrigé
                    </label>

                    <Textarea
                      value={
                        question.correctAnswer
                      }
                      onChange={(event) =>
                        updateQuestion(
                          question.id,
                          "correctAnswer",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Points
                    </label>

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
            )
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Enregistrement
            </>
          ) : (
            <>
              <Save className="size-4" />
              Enregistrer les modifications
            </>
          )}
        </Button>
      </div>
    </form>
  );
}