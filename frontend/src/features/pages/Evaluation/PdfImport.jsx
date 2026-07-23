import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createEvaluation } from "@/services/evaluation.service";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { extractPdf } from "@/services/pdf.service";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function normalizeQuestion(question, index) {
  return {
    id: crypto.randomUUID(),
    statement: question.statement || "",
    type: question.type || "SHORT_TEXT",
    choices: Array.isArray(question.choices)
      ? question.choices
      : [],
    correctAnswer: question.correctAnswer || "",
    points: Number(question.points) || 1,
    order: index + 1,
  };
}

export default function PdfImport() {
  const [searchParams] = useSearchParams();
const navigate = useNavigate();

  const contentType =
    searchParams.get("contentType") || "EVALUATION";

  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] =
    useState(null);
  const [error, setError] = useState("");

  function validateAndSetFile(selectedFile) {
    setError("");
    setExtractedData(null);

    if (!selectedFile) {
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setError(
        "Veuillez sélectionner uniquement un fichier PDF."
      );
      return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (selectedFile.size > maximumSize) {
      setError(
        "Le fichier ne doit pas dépasser 10 Mo."
      );
      return;
    }

    setFile(selectedFile);
  }

  function handleFileChange(event) {
    validateAndSetFile(event.target.files?.[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    validateAndSetFile(
      event.dataTransfer.files?.[0]
    );
  }

  function removeFile() {
    setFile(null);
    setExtractedData(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function extractQuestions() {
    if (!file) {
      setError("Sélectionnez d’abord un PDF.");
      return;
    }

    setLoading(true);
    setError("");
    setExtractedData(null);

    try {
      const data = await extractPdf(file);

      const evaluation = data.evaluation || {};

      setExtractedData({
        fichier: data.fichier,
        nombrePages: data.nombrePages,
        title: evaluation.title || "",
        description:
          evaluation.description || "",
        duration:
          Number(evaluation.duration) || 60,
        questions: Array.isArray(
          evaluation.questions
        )
          ? evaluation.questions.map(
              normalizeQuestion
            )
          : [],
      });
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.response?.data?.message ||
          "Une erreur est survenue pendant l’extraction."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateEvaluationField(field, value) {
    setExtractedData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateQuestion(
    questionId,
    field,
    value
  ) {
    setExtractedData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) =>
          question.id === questionId
            ? {
                ...question,
                [field]: value,
              }
            : question
      ),
    }));
  }

  function updateChoice(
    questionId,
    choiceIndex,
    value
  ) {
    setExtractedData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) => {
          if (question.id !== questionId) {
            return question;
          }

          const choices = [...question.choices];

          choices[choiceIndex] = value;

          return {
            ...question,
            choices,
          };
        }
      ),
    }));
  }

  function addChoice(questionId) {
    setExtractedData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) =>
          question.id === questionId
            ? {
                ...question,
                choices: [
                  ...question.choices,
                  "",
                ],
              }
            : question
      ),
    }));
  }

  function removeChoice(
    questionId,
    choiceIndex
  ) {
    setExtractedData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) =>
          question.id === questionId
            ? {
                ...question,
                choices:
                  question.choices.filter(
                    (_, index) =>
                      index !== choiceIndex
                  ),
              }
            : question
      ),
    }));
  }

  function addQuestion() {
    setExtractedData((current) => ({
      ...current,
      questions: [
        ...current.questions,
        normalizeQuestion(
          {
            statement: "",
            type: "SHORT_TEXT",
            choices: [],
            correctAnswer: "",
            points: 1,
          },
          current.questions.length
        ),
      ],
    }));
  }

  function removeQuestion(questionId) {
    setExtractedData((current) => ({
      ...current,
      questions: current.questions.filter(
        (question) =>
          question.id !== questionId
      ),
    }));
  }

 async function handleSave(status = "ACTIVE") {
  if (!extractedData) {
    return;
  }

  if (!extractedData.title.trim()) {
    setError("Le titre est obligatoire.");
    return;
  }

  if (extractedData.questions.length === 0) {
    setError("L’évaluation doit contenir au moins une question.");
    return;
  }

  const invalidQuestionIndex = extractedData.questions.findIndex(
    (question) => !question.statement.trim()
  );

  if (invalidQuestionIndex !== -1) {
    setError(
      `L’énoncé de la question ${invalidQuestionIndex + 1} est obligatoire.`
    );
    return;
  }

  const payload = {
    contentType,
    title: extractedData.title.trim(),
    description: extractedData.description?.trim() || null,
    instructions:
      "Répondez à toutes les questions avant la fin du temps imparti.",
    duration: Number(extractedData.duration),
    type: "CLASSIC",
    status,
    questions: extractedData.questions.map((question) => ({
      statement: question.statement.trim(),
      type: question.type,
      choices:
        question.type === "QCM"
          ? question.choices
              .map((choice) => choice.trim())
              .filter(Boolean)
          : [],
      correctAnswer: question.correctAnswer?.trim() || null,
      points: Number(question.points) || 1,
    })),
  };

  setSaving(true);
  setError("");
  setSuccess("");

  try {
    const evaluation = await createEvaluation(payload);
    const accessCode = evaluation.publications?.[0]?.code;

    setSuccess(
      accessCode
        ? `Évaluation créée et publiée avec succès. Code d’accès : ${accessCode}`
        : "Évaluation créée avec succès. Ouvre l’onglet « Publications » pour générer un code d’accès."
    );

    window.setTimeout(() => {
      navigate(`/evaluations/${evaluation.id}`);
    }, 1500);
  } catch (requestError) {
    console.error(requestError);

    setError(
      requestError.response?.data?.message ||
        "Impossible d’enregistrer l’évaluation."
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">
          {contentType === "EXERCISE"
            ? "Exercice"
            : "Évaluation"}
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Importer un PDF
        </h1>

        <p className="mt-2 text-muted-foreground">
          Gemma extraira les questions, les
          réponses proposées et le barème.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fichier source</CardTitle>

          <CardDescription>
            Formats acceptés : PDF. Taille
            maximale : 10 Mo.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {!file ? (
            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) =>
                event.preventDefault()
              }
              onDragLeave={() =>
                setDragging(false)
              }
              onDrop={handleDrop}
              onClick={() =>
                inputRef.current?.click()
              }
              className={[
                "flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
              ].join(" ")}
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Upload className="size-7" />
              </div>

              <p className="mt-5 text-lg font-semibold">
                Glissez votre PDF ici
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                ou cliquez pour sélectionner un
                fichier
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-5"
              >
                Choisir un fichier
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border p-5">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                  <FileText className="size-6" />
                </div>

                <div>
                  <p className="font-semibold">
                    {file.name}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {(
                      file.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    Mo
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={removeFile}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {error && (
            <p className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!file || loading}
              onClick={extractQuestions}
            >
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Analyse avec Gemma
                </>
              ) : (
                <>
                  <FileText className="size-4" />
                  Extraire les questions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {extractedData && (
        <>
          <div className="flex gap-3 rounded-xl border bg-muted/40 p-4">
            <CheckCircle2 className="mt-0.5 size-5 text-primary" />

            <div>
              <p className="font-semibold">
                Extraction terminée
              </p>

              <p className="text-sm text-muted-foreground">
                {
                  extractedData.questions
                    .length
                }{" "}
                question(s) extraite(s) depuis{" "}
                {extractedData.fichier}.
              </p>
            </div>
          </div>

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
                  value={
                    extractedData.title
                  }
                  onChange={(event) =>
                    updateEvaluationField(
                      "title",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">
                  Description
                </label>

                <Textarea
                  value={
                    extractedData.description
                  }
                  onChange={(event) =>
                    updateEvaluationField(
                      "description",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Durée en minutes
                </label>

                <Input
                  min="1"
                  type="number"
                  value={
                    extractedData.duration
                  }
                  onChange={(event) =>
                    updateEvaluationField(
                      "duration",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Pages analysées
                </label>

                <Input
                  disabled
                  value={
                    extractedData.nombrePages
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Questions extraites
              </CardTitle>

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
              {extractedData.questions.map(
                (question, index) => (
                  <div
                    key={question.id}
                    className="space-y-5 rounded-xl border p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        Question {index + 1}
                      </p>

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
                        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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

                    {question.type ===
                      "QCM" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">
                            Choix
                          </label>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              addChoice(
                                question.id
                              )
                            }
                          >
                            <Plus className="size-4" />
                            Ajouter
                          </Button>
                        </div>

                        {question.choices.map(
                          (
                            choice,
                            choiceIndex
                          ) => (
                            <div
                              key={
                                choiceIndex
                              }
                              className="flex gap-2"
                            >
                              <Input
                                value={choice}
                                onChange={(
                                  event
                                ) =>
                                  updateChoice(
                                    question.id,
                                    choiceIndex,
                                    event
                                      .target
                                      .value
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

                    <div className="grid gap-4 md:grid-cols-[1fr_130px]">
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
                              event.target
                                .value
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Points
                        </label>

                        <Input
                          min="0"
                          type="number"
                          value={
                            question.points
                          }
                          onChange={(event) =>
                            updateQuestion(
                              question.id,
                              "points",
                              event.target
                                .value
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
          {success && (
  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
    <p className="font-medium text-green-700">{success}</p>
  </div>
)}

         <div className="flex justify-end gap-3">
  <Button
    type="button"
    variant="outline"
    disabled={saving}
    onClick={() => handleSave("DRAFT")}
  >
    Enregistrer en brouillon
  </Button>

  <Button
    type="button"
    disabled={saving}
    onClick={() => handleSave("ACTIVE")}
  >
    {saving ? (
      <>
        <LoaderCircle className="size-4 animate-spin" />
        Enregistrement
      </>
    ) : (
      "Créer et activer"
    )}
  </Button>
</div>
        </>
      )}
    </div>
  );
}