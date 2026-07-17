import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  FileText,
  PenSquare,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const creationMethods = [
  {
    title: "Création manuelle",
    description: "Ajoutez vous-même les questions, les réponses et les points.",
    icon: PenSquare,
    path: "manual",
  },
  {
    title: "Importer un PDF",
    description:
      "Déposez un sujet existant afin d’en extraire automatiquement les questions.",
    icon: FileText,
    path: "pdf",
  },
  {
    title: "Générer avec l’IA",
    description:
      "Indiquez le sujet, le niveau et le nombre de questions à générer.",
    icon: Sparkles,
    path: "ai",
  },
];

function CreationSection({ type, title, description }) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ClipboardCheck className="size-5" />
        </div>

        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {creationMethods.map(({ title: methodTitle, description, icon: Icon, path }) => (
          <Button
            key={path}
            asChild
            variant="outline"
            className="h-auto w-full justify-start gap-4 whitespace-normal p-4 text-left"
          >
            <Link to={`/evaluations/create/${path}?contentType=${type}`}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5" />
              </div>

              <div>
                <p className="font-semibold">{methodTitle}</p>
                <p className="mt-1 text-sm font-normal text-muted-foreground">
                  {description}
                </p>
              </div>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

export default function CreateChoice() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Que souhaitez-vous créer ?
        </h1>

        <p className="mt-2 text-muted-foreground">
          Choisissez le type de contenu puis son mode de création.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreationSection
          type="EXERCISE"
          title="Exercice"
          description="Créez une activité d’entraînement qui peut être notée ou non."
        />

        <CreationSection
          type="EVALUATION"
          title="Évaluation"
          description="Créez une épreuve chronométrée avec un code d’accès."
        />
      </div>
    </div>
  );
}