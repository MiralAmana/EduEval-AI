import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, GraduationCap, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEvaluations } from "@/services/evaluation.service";

const statusLabels = {
  IN_PROGRESS: "En cours",
  SUBMITTED: "Terminée",
  BLOCKED: "Bloquée",
  EXPIRED: "Expirée",
};

const statusVariants = {
  IN_PROGRESS: "secondary",
  SUBMITTED: "default",
  BLOCKED: "destructive",
  EXPIRED: "secondary",
};

function flattenAttempts(evaluations) {
  return evaluations.flatMap((evaluation) =>
    (evaluation.publications || []).flatMap((publication) =>
      (publication.attempts || []).map((attempt) => ({
        ...attempt,
        evaluationId: evaluation.id,
        evaluationTitle: evaluation.title,
      }))
    )
  );
}

export default function Students() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        setError("");

        const evaluations = await getEvaluations();

        const allAttempts = flattenAttempts(
          Array.isArray(evaluations) ? evaluations : []
        ).sort(
          (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
        );

        setAttempts(allAttempts);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Impossible de récupérer les étudiants."
        );
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Étudiants</h1>
        <p className="mt-1 text-muted-foreground">
          Suivez les participants, leurs tentatives et leurs sorties, toutes
          évaluations confondues.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

          <div>
            <p className="font-medium text-destructive">
              Une erreur est survenue
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Participants{" "}
            {!loading && (
              <span className="font-normal text-muted-foreground">
                ({attempts.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : attempts.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center py-10 text-center">
              <GraduationCap className="size-10 text-muted-foreground" />

              <p className="mt-4 font-medium">Aucun participant pour l’instant</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Les étudiants apparaîtront ici dès qu’ils rejoindront une de
                tes évaluations publiées.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Évaluation</TableHead>
                  <TableHead>Sorties</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>

              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium">
                      {attempt.student?.firstName} {attempt.student?.lastName}
                    </TableCell>
                    <TableCell>{attempt.student?.email}</TableCell>
                    <TableCell>{attempt.evaluationTitle}</TableCell>
                    <TableCell>{attempt.exitCount}/3</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariants[attempt.status] || "secondary"}
                      >
                        {statusLabels[attempt.status] || attempt.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {attempt.status !== "IN_PROGRESS" && (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={`/evaluations/${attempt.evaluationId}/attempts/${attempt.id}`}
                          >
                            {attempt.resultsPublished
                              ? "Voir la correction"
                              : "Corriger"}
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
