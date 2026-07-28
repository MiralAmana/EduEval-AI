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

function groupAttemptsByEvaluation(evaluations) {
  const groups = evaluations
    .map((evaluation) => {
      const attempts = (evaluation.publications || [])
        .flatMap((publication) => publication.attempts || [])
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

      return {
        evaluationId: evaluation.id,
        evaluationTitle: evaluation.title,
        attempts,
      };
    })
    .filter((group) => group.attempts.length > 0);

  return groups.sort(
    (a, b) =>
      new Date(b.attempts[0].startedAt) - new Date(a.attempts[0].startedAt)
  );
}

export default function Students() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        setError("");

        const evaluations = await getEvaluations();

        setGroups(
          groupAttemptsByEvaluation(
            Array.isArray(evaluations) ? evaluations : []
          )
        );
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

  const totalAttempts = groups.reduce(
    (sum, group) => sum + group.attempts.length,
    0
  );

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

      {loading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center py-10 text-center">
            <GraduationCap className="size-10 text-muted-foreground" />

            <p className="mt-4 font-medium">Aucun participant pour l’instant</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Les étudiants apparaîtront ici dès qu’ils rejoindront une de
              tes évaluations publiées.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {totalAttempts} participation{totalAttempts > 1 ? "s" : ""} au
            total, sur {groups.length} évaluation
            {groups.length > 1 ? "s" : ""}.
          </p>

          {groups.map((group) => (
            <Card key={group.evaluationId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <Link
                    to={`/evaluations/${group.evaluationId}`}
                    className="hover:underline"
                  >
                    {group.evaluationTitle}
                  </Link>

                  <span className="text-sm font-normal text-muted-foreground">
                    {group.attempts.length} participant
                    {group.attempts.length > 1 ? "s" : ""}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Étudiant</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Sorties</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {group.attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-medium">
                          {attempt.student?.firstName}{" "}
                          {attempt.student?.lastName}
                        </TableCell>
                        <TableCell>{attempt.student?.email}</TableCell>
                        <TableCell>{attempt.exitCount}/3</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              statusVariants[attempt.status] || "secondary"
                            }
                          >
                            {statusLabels[attempt.status] || attempt.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {attempt.status !== "IN_PROGRESS" && (
                            <Button asChild size="sm" variant="outline">
                              <Link
                                to={`/evaluations/${group.evaluationId}/attempts/${attempt.id}`}
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
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
