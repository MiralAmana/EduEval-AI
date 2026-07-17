import { Badge } from "@/components/ui/badge";
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

const students = [
  {
    name: "Awa Ndiaye",
    email: "awa@example.com",
    evaluation: "Word niveau 1",
    exits: 0,
    status: "Terminée",
  },
  {
    name: "Moussa Diop",
    email: "moussa@example.com",
    evaluation: "Word niveau 1",
    exits: 1,
    status: "En cours",
  },
  {
    name: "Fatou Fall",
    email: "fatou@example.com",
    evaluation: "Excel niveau 1",
    exits: 3,
    status: "Bloquée",
  },
];

function Students() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Étudiants</h1>
        <p className="mt-1 text-muted-foreground">
          Suivez les participants, leurs tentatives et leurs sorties.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participants récents</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étudiant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Évaluation</TableHead>
                <TableHead>Sorties</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {students.map((student) => (
                <TableRow key={student.email}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.evaluation}</TableCell>
                  <TableCell>{student.exits}/3</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        student.status === "Bloquée"
                          ? "destructive"
                          : student.status === "Terminée"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {student.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default Students;