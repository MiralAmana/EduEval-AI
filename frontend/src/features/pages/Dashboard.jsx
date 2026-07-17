import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Plus,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const statistics = [
  {
    title: "Évaluations",
    value: "14",
    description: "3 actuellement actives",
    icon: BookOpenCheck,
  },
  {
    title: "Participants",
    value: "183",
    description: "Sur toutes les évaluations",
    icon: GraduationCap,
  },
  {
    title: "Terminées",
    value: "142",
    description: "Tentatives soumises",
    icon: CheckCircle2,
  },
  {
    title: "Bloquées",
    value: "4",
    description: "Après trois sorties",
    icon: ShieldAlert,
  },
];

const evaluations = [
  {
    id: 1,
    title: "Word — Lettre professionnelle",
    code: "WORD26",
    participants: 35,
    finished: 21,
    status: "Active",
  },
  {
    id: 2,
    title: "Introduction à Excel",
    code: "EXCEL4",
    participants: 18,
    finished: 18,
    status: "Terminée",
  },
  {
    id: 3,
    title: "Bases de PowerPoint",
    code: "PPT2026",
    participants: 0,
    finished: 0,
    status: "Brouillon",
  },
];

function Dashboard() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bonjour Charlize
          </h1>
          <p className="mt-1 text-muted-foreground">
            Voici un aperçu de vos évaluations.
          </p>
        </div>

        <Button asChild>
          <Link to="/evaluations/create">
            <Plus className="size-4" />
            Nouvelle évaluation
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statistics.map(({ title, value, description, icon: Icon }) => (
          <Card key={title}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{title}</p>
                  <p className="mt-2 text-3xl font-bold">{value}</p>
                </div>

                <div className="rounded-lg bg-muted p-2.5">
                  <Icon className="size-5" />
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                {description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Évaluations récentes</h2>
            <p className="text-sm text-muted-foreground">
              Suivez leur progression en temps réel.
            </p>
          </div>

          <Button variant="ghost" asChild>
            <Link to="/evaluations">
              Tout afficher
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {evaluations.map((evaluation) => (
            <Card key={evaluation.id}>
              <CardContent className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold">{evaluation.title}</h3>

                    <Badge
                      variant={
                        evaluation.status === "Active"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {evaluation.status}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Code :{" "}
                    <span className="font-medium text-foreground">
                      {evaluation.code}
                    </span>
                  </p>
                </div>

                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground">Participants</p>
                    <p className="mt-1 font-semibold">
                      {evaluation.participants}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Terminés</p>
                    <p className="mt-1 font-semibold">
                      {evaluation.finished}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">État</p>
                    <p className="mt-1 flex items-center gap-1 font-semibold">
                      <Clock3 className="size-3.5" />
                      {evaluation.status}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;