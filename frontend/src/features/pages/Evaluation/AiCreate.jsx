import { useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { generateEvaluation } from "@/services/ai.service";
import { createEvaluation } from "@/services/evaluation.service";

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

const subjectOptions = {
  WORD: [
    "Découverte de Microsoft Word",
    "Saisie et modification de texte",
    "Mise en forme des caractères",
    "Mise en forme des paragraphes",
    "Alignement et retrait",
    "Listes à puces et numérotées",
    "Bordures et trames",
    "Mise en page du document",
    "Marges et orientation",
    "En-têtes et pieds de page",
    "Numérotation des pages",
    "Insertion et modification d’images",
    "Création et mise en forme de tableaux",
    "Colonnes de texte",
    "Tabulations",
    "Styles et thèmes",
    "Table des matières automatique",
    "Notes de bas de page",
    "Publipostage",
    "Création d’une lettre professionnelle",
    "Création d’un CV professionnel",
    "Révision et commentaires",
    "Protection d’un document",
    "Impression et export PDF",
    "Autre",
  ],

  EXCEL: [
    "Découverte de Microsoft Excel",
    "Saisie et organisation des données",
    "Mise en forme des cellules",
    "Références relatives et absolues",
    "Calculs avec les opérateurs",
    "Fonctions SOMME, MOYENNE, MIN et MAX",
    "Fonction SI",
    "Fonctions ET et OU",
    "Fonctions NB, NBVAL et NB.SI",
    "Fonctions SOMME.SI et MOYENNE.SI",
    "Fonctions de texte",
    "Fonctions de date et d’heure",
    "Tri et filtrage des données",
    "Mise en forme conditionnelle",
    "Création de graphiques",
    "Tableaux Excel",
    "Tableaux croisés dynamiques",
    "Validation des données",
    "Listes déroulantes",
    "RECHERCHEV et RECHERCHEX",
    "Gestion de plusieurs feuilles",
    "Protection des feuilles",
    "Mise en page et impression",
    "Création d’un budget",
    "Création d’une facture",
    "Création d’un bulletin de notes",
    "Autre",
  ],

  POWERPOINT: [
    "Découverte de Microsoft PowerPoint",
    "Création d’une présentation",
    "Gestion des diapositives",
    "Choix d’un thème",
    "Mise en page des diapositives",
    "Insertion et mise en forme du texte",
    "Insertion d’images",
    "Insertion de formes",
    "Insertion d’icônes",
    "Création de tableaux",
    "Création de graphiques",
    "Insertion de SmartArt",
    "Transitions entre les diapositives",
    "Animations des objets",
    "Ordre et minutage des animations",
    "Masque des diapositives",
    "En-têtes et pieds de page",
    "Ajout de vidéos et de sons",
    "Liens hypertextes et boutons d’action",
    "Mode présentateur",
    "Préparation d’un diaporama",
    "Bonnes pratiques de présentation",
    "Export en PDF ou vidéo",
    "Création d’une présentation professionnelle",
    "Autre",
  ],
};

const softwareNames = {
  WORD: "Microsoft Word",
  EXCEL: "Microsoft Excel",
  POWERPOINT: "Microsoft PowerPoint",
};

function normalizeQuestion(question) {
  return {
    id: crypto.randomUUID(),
    statement: question.statement || "",
    type: question.type || "SHORT_TEXT",
    choices: Array.isArray(question.choices)
      ? question.choices
      : [],
    correctAnswer: question.correctAnswer || "",
    points: Number(question.points) || 1,
  };
}

export default function AiCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const contentType =
    searchParams.get("contentType") || "EVALUATION";

  const [form, setForm] = useState({
    software: "WORD",
    topics: [subjectOptions.WORD[0]],
    customTopic: "",
    level: "Débutant",
    questionCount: 10,
    questionType: "MIXED",
    objectives: "",
    duration: 60,
  });

  const [generatedData, setGeneratedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateForm(event) {
    const { name, value } = event.target;

    if (name === "software") {
      setForm((current) => ({
        ...current,
        software: value,
        topics: [subjectOptions[value][0]],
        customTopic: "",
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function toggleTopic(topic) {
    setForm((current) => {
      const alreadySelected =
        current.topics.includes(topic);

      return {
        ...current,
        topics: alreadySelected
          ? current.topics.filter(
              (selectedTopic) =>
                selectedTopic !== topic
            )
          : [...current.topics, topic],
      };
    });
  }

  function getSelectedTopics() {
    const selectedTopics = form.topics
      .filter((topic) => topic !== "Autre")
      .map((topic) => topic.trim());

    if (
      form.topics.includes("Autre") &&
      form.customTopic.trim()
    ) {
      selectedTopics.push(
        form.customTopic.trim()
      );
    }

    return selectedTopics;
  }

  function getFinalSubject() {
    return `${softwareNames[form.software]} — ${getSelectedTopics().join(
      ", "
    )}`;
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (form.topics.length === 0) {
      setError(
        "Sélectionne au moins un sujet."
      );
      return;
    }

    if (
      form.topics.includes("Autre") &&
      !form.customTopic.trim()
    ) {
      setError(
        "Précise le sujet personnalisé."
      );
      return;
    }

    setLoading(true);
    setError("");
    setGeneratedData(null);

    try {
      const data = await generateEvaluation({
        subject: getFinalSubject(),
        software: form.software,
        topics: getSelectedTopics(),
        level: form.level,
        questionCount: Number(
          form.questionCount
        ),
        questionType: form.questionType,
        objectives: form.objectives,
        duration: Number(form.duration),
        contentType,
      });

      setGeneratedData({
        ...data.evaluation,
        questions:
          data.evaluation.questions.map(
            normalizeQuestion
          ),
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Impossible de générer l’évaluation."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateEvaluation(field, value) {
    setGeneratedData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateQuestion(
    questionId,
    field,
    value
  ) {
    setGeneratedData((current) => ({
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
    setGeneratedData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) => {
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
        }
      ),
    }));
  }

  function addChoice(questionId) {
    setGeneratedData((current) => ({
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
    setGeneratedData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) => {
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
        }
      ),
    }));
  }

  function addQuestion() {
    setGeneratedData((current) => ({
      ...current,
      questions: [
        ...current.questions,
        normalizeQuestion({
          statement: "",
          type: "SHORT_TEXT",
          choices: [],
          correctAnswer: "",
          points: 1,
        }),
      ],
    }));
  }

  function removeQuestion(questionId) {
    setGeneratedData((current) => ({
      ...current,
      questions:
        current.questions.filter(
          (question) =>
            question.id !== questionId
        ),
    }));
  }

  async function handleSave(status) {
    if (!generatedData) {
      return;
    }

    if (!generatedData.title?.trim()) {
      setError(
        "Le titre est obligatoire."
      );
      return;
    }

    if (
      !generatedData.questions?.length
    ) {
      setError(
        "Ajoute au moins une question."
      );
      return;
    }

    const invalidQuestionIndex =
      generatedData.questions.findIndex(
        (question) =>
          !question.statement?.trim()
      );

    if (invalidQuestionIndex !== -1) {
      setError(
        `L’énoncé de la question ${
          invalidQuestionIndex + 1
        } est obligatoire.`
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const evaluation =
        await createEvaluation({
          contentType,
          title:
            generatedData.title.trim(),
          description:
            generatedData.description?.trim() ||
            null,
          instructions:
            generatedData.instructions?.trim() ||
            null,
          duration: Number(
            generatedData.duration
          ),
          type: form.software,
          status,
          questions:
            generatedData.questions.map(
              ({
                id,
                ...question
              }) => ({
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
                  question.correctAnswer?.trim() ||
                  null,
                points:
                  Number(
                    question.points
                  ) || 1,
              })
            ),
        });

      alert(
        `Création réussie. Code d’accès : ${evaluation.code}`
      );

      navigate("/evaluations");
    } catch (requestError) {
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
          Générer avec l’IA
        </h1>

        <p className="mt-2 text-muted-foreground">
          Sélectionnez un ou plusieurs sujets à intégrer.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Paramètres de génération
          </CardTitle>

          <CardDescription>
            Groq générera les questions, le
            corrigé et le barème.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-6"
            onSubmit={handleGenerate}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Logiciel
              </label>

              <select
                name="software"
                value={form.software}
                onChange={updateForm}
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="WORD">
                  Microsoft Word
                </option>

                <option value="EXCEL">
                  Microsoft Excel
                </option>

                <option value="POWERPOINT">
                  Microsoft PowerPoint
                </option>
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium">
                  Sujets
                </label>

                <p className="text-xs text-muted-foreground">
                  {form.topics.length} sélectionné(s)
                </p>
              </div>

              <div className="grid max-h-96 gap-3 overflow-y-auto rounded-xl border p-4 md:grid-cols-2">
                {subjectOptions[
                  form.software
                ].map((topic) => {
                  const selected =
                    form.topics.includes(
                      topic
                    );

                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() =>
                        toggleTopic(topic)
                      }
                      className={[
                        "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "hover:bg-muted",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>{topic}</span>

                        {selected && (
                          <span className="text-xs">
                            ✓
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.topics.includes(
              "Autre"
            ) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Sujet personnalisé
                </label>

                <Input
                  name="customTopic"
                  value={form.customTopic}
                  onChange={updateForm}
                  placeholder="Ex. Gestion des longs documents Word"
                />
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Niveau
                </label>

                <select
                  name="level"
                  value={form.level}
                  onChange={updateForm}
                  className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option>
                    Débutant
                  </option>

                  <option>
                    Intermédiaire
                  </option>

                  <option>
                    Avancé
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nombre de questions
                </label>

                <Input
                  type="number"
                  min="1"
                  max="100"
                  name="questionCount"
                  value={
                    form.questionCount
                  }
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type de questions
              </label>

              <select
                name="questionType"
                value={form.questionType}
                onChange={updateForm}
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="MIXED">
                  Mélange
                </option>

                <option value="QCM">
                  QCM
                </option>

                <option value="SHORT_TEXT">
                  Réponses courtes
                </option>

                <option value="LONG_TEXT">
                  Réponses longues
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Objectifs pédagogiques
              </label>

              <Textarea
                name="objectives"
                value={form.objectives}
                onChange={updateForm}
                placeholder="Ex. Vérifier que l’apprenant maîtrise les tableaux, les tabulations et le publipostage."
              />
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-medium">
                Sujet envoyé à l’IA
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {getFinalSubject()}
              </p>
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Génération en cours
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Générer
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {generatedData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Informations générées
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Titre
                </label>

                <Input
                  value={
                    generatedData.title
                  }
                  onChange={(event) =>
                    updateEvaluation(
                      "title",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Description
                </label>

                <Textarea
                  value={
                    generatedData.description ||
                    ""
                  }
                  onChange={(event) =>
                    updateEvaluation(
                      "description",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Instructions
                </label>

                <Textarea
                  value={
                    generatedData.instructions ||
                    ""
                  }
                  onChange={(event) =>
                    updateEvaluation(
                      "instructions",
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
                  type="number"
                  min="1"
                  value={
                    generatedData.duration
                  }
                  onChange={(event) =>
                    updateEvaluation(
                      "duration",
                      event.target.value
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>
                Questions générées
              </CardTitle>

              <Button
                type="button"
                variant="outline"
                onClick={addQuestion}
              >
                <Plus className="size-4" />
                Ajouter
              </Button>
            </CardHeader>

            <CardContent className="space-y-5">
              {generatedData.questions.map(
                (
                  question,
                  index
                ) => (
                  <div
                    key={question.id}
                    className="space-y-5 rounded-xl border p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <strong>
                        Question{" "}
                        {index + 1}
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
                        value={
                          question.type
                        }
                        onChange={(event) =>
                          updateQuestion(
                            question.id,
                            "type",
                            event.target
                              .value
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
                            event.target
                              .value
                          )
                        }
                      />
                    </div>

                    {question.type ===
                      "QCM" && (
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
                              addChoice(
                                question.id
                              )
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
                              key={
                                choiceIndex
                              }
                              className="flex gap-2"
                            >
                              <Input
                                value={
                                  choice
                                }
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
                          Bonne réponse ou corrigé
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
                          type="number"
                          min="0"
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

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() =>
                handleSave("DRAFT")
              }
            >
              Enregistrer en brouillon
            </Button>

            <Button
              type="button"
              disabled={saving}
              onClick={() =>
                handleSave("ACTIVE")
              }
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