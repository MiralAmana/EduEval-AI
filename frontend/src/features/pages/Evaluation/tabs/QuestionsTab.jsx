import {
  CheckCircle2,
  Circle,
  FileQuestion,
  GripVertical,
  ListChecks,
  MessageSquareText,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

/**
 * Retourne le libellé lisible d'un type de question.
 */
function getQuestionTypeLabel(type) {
  const normalizedType = String(type || "")
    .trim()
    .toUpperCase();

  const labels = {
    QCM: "Choix multiple",
    MCQ: "Choix multiple",
    MULTIPLE_CHOICE: "Choix multiple",

    SINGLE_CHOICE: "Choix unique",
    UNIQUE_CHOICE: "Choix unique",

    TRUE_FALSE: "Vrai ou faux",
    BOOLEAN: "Vrai ou faux",

    OPEN: "Réponse ouverte",
    OPEN_QUESTION: "Réponse ouverte",
    TEXT: "Réponse texte",
    SHORT_TEXT: "Réponse courte",
    LONG_TEXT: "Réponse longue",

    CODE: "Question de code",
    CODE_COMPLETION: "Code à compléter",

    FILE: "Dépôt de fichier",
    PRACTICAL: "Exercice pratique",
  };

  return (
    labels[normalizedType] ||
    type ||
    "Type non défini"
  );
}

/**
 * Retourne le nombre de points d'une question.
 */
function getQuestionPoints(question) {
  const points =
    question?.points ??
    question?.score ??
    question?.maxScore ??
    question?.weight ??
    0;

  const numericPoints = Number(points);

  if (Number.isNaN(numericPoints)) {
    return 0;
  }

  return numericPoints;
}

/**
 * Retourne les choix d'une question.
 */
function getQuestionChoices(question) {
  if (Array.isArray(question?.choices)) {
    return question.choices;
  }

  if (Array.isArray(question?.options)) {
    return question.options;
  }

  if (Array.isArray(question?.answers)) {
    return question.answers;
  }

  return [];
}

/**
 * Retourne les critères de correction.
 */
function getQuestionCriteria(question) {
  if (Array.isArray(question?.criteria)) {
    return question.criteria;
  }

  if (Array.isArray(question?.criterions)) {
    return question.criterions;
  }

  if (Array.isArray(question?.rubric)) {
    return question.rubric;
  }

  return [];
}

/**
 * Détermine si un choix est correct.
 */
function isChoiceCorrect(choice) {
  return Boolean(
    choice?.isCorrect ??
      choice?.correct ??
      choice?.isAnswer ??
      choice?.valid
  );
}

/**
 * Retourne le texte d'un choix.
 */
function getChoiceText(choice) {
  return (
    choice?.text ||
    choice?.label ||
    choice?.content ||
    choice?.answer ||
    "Choix sans texte"
  );
}

/**
 * Retourne le texte principal d'une question.
 */
function getQuestionText(question) {
  return (
    question?.text ||
    question?.content ||
    question?.question ||
    question?.statement ||
    question?.label ||
    "Question sans énoncé"
  );
}

/**
 * Retourne l'explication ou la correction.
 */
function getQuestionExplanation(question) {
  return (
    question?.explanation ||
    question?.correction ||
    question?.feedback ||
    question?.expectedAnswer ||
    ""
  );
}

/**
 * Affiche un choix de réponse.
 */
function ChoiceItem({ choice, index }) {
  const correct = isChoiceCorrect(choice);

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        correct
          ? "border-emerald-200 bg-emerald-50"
          : "bg-background"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {correct ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">
            Choix {index + 1}
          </span>

          {correct && (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-100 text-emerald-700"
            >
              Bonne réponse
            </Badge>
          )}
        </div>

        <p className="mt-1 whitespace-pre-wrap text-sm">
          {getChoiceText(choice)}
        </p>
      </div>
    </div>
  );
}

/**
 * Affiche un critère de correction.
 */
function CriterionItem({ criterion, index }) {
  const label =
    criterion?.label ||
    criterion?.name ||
    criterion?.description ||
    criterion?.text ||
    `Critère ${index + 1}`;

  const points =
    criterion?.points ??
    criterion?.score ??
    criterion?.maxScore;

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

        <div>
          <p className="font-medium">
            {label}
          </p>

          {criterion?.description &&
            criterion.description !== label && (
              <p className="mt-1 text-sm text-muted-foreground">
                {criterion.description}
              </p>
            )}
        </div>
      </div>

      {points !== undefined &&
        points !== null && (
          <Badge variant="secondary">
            {points} pt
            {Number(points) > 1 ? "s" : ""}
          </Badge>
        )}
    </div>
  );
}

/**
 * Carte complète d'une question.
 */
function QuestionCard({
  question,
  index,
}) {
  const choices = getQuestionChoices(question);
  const criteria =
    getQuestionCriteria(question);

  const questionType =
    getQuestionTypeLabel(
      question?.type ||
        question?.questionType
    );

  const points =
    getQuestionPoints(question);

  const explanation =
    getQuestionExplanation(question);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-start gap-3">
          <GripVertical className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Question {index + 1}
              </Badge>

              <Badge variant="outline">
                {questionType}
              </Badge>

              <Badge variant="outline">
                {points} pt
                {points > 1 ? "s" : ""}
              </Badge>
            </div>

            <CardTitle className="mt-4 whitespace-pre-wrap text-lg leading-7">
              {getQuestionText(question)}
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {choices.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <ListChecks className="h-5 w-5 text-primary" />

              Choix de réponses
            </h3>

            <div className="mt-3 space-y-3">
              {choices.map(
                (choice, choiceIndex) => (
                  <ChoiceItem
                    key={
                      choice?.id ||
                      `${question?.id}-${choiceIndex}`
                    }
                    choice={choice}
                    index={choiceIndex}
                  />
                )
              )}
            </div>
          </div>
        )}

        {criteria.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <ListChecks className="h-5 w-5 text-primary" />

              Critères de correction
            </h3>

            <div className="mt-3 space-y-3">
              {criteria.map(
                (criterion, criterionIndex) => (
                  <CriterionItem
                    key={
                      criterion?.id ||
                      `${question?.id}-criterion-${criterionIndex}`
                    }
                    criterion={criterion}
                    index={criterionIndex}
                  />
                )
              )}
            </div>
          </div>
        )}

        {explanation && (
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <MessageSquareText className="h-5 w-5 text-primary" />

              Correction ou explication
            </h3>

            <div className="mt-3 rounded-lg border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap text-sm leading-6">
                {explanation}
              </p>
            </div>
          </div>
        )}

        {choices.length === 0 &&
          criteria.length === 0 &&
          !explanation && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun choix, critère ou corrigé n’est associé à cette question.
              </p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

export default function QuestionsTab({
  evaluation,
}) {
  const questions = Array.isArray(
    evaluation?.questions
  )
    ? evaluation.questions
    : [];

  const totalPoints = questions.reduce(
    (total, question) =>
      total + getQuestionPoints(question),
    0
  );

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>

          <h2 className="mt-5 text-xl font-semibold">
            Aucune question
          </h2>

          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Cette évaluation ne contient pas encore de
            questions. Tu peux la modifier pour en ajouter
            manuellement, depuis un PDF ou avec
            l’intelligence artificielle.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Questions de l’évaluation
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Consulte les énoncés, les réponses et les
                critères de correction.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="px-3 py-1.5"
              >
                {questions.length} question
                {questions.length > 1 ? "s" : ""}
              </Badge>

              <Badge
                variant="outline"
                className="px-3 py-1.5"
              >
                {totalPoints} point
                {totalPoints > 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {questions.map(
          (question, index) => (
            <QuestionCard
              key={
                question?.id ||
                `question-${index}`
              }
              question={question}
              index={index}
            />
          )
        )}
      </div>
    </div>
  );
}