import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { joinEvaluation } from "@/services/attempt.service";

function StudentAccess() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const { attempt } = await joinEvaluation({
        firstName,
        lastName,
        email,
        code,
      });

      navigate(`/evaluation/${attempt.id}`);
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "Impossible d’accéder à cette évaluation."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpenCheck className="size-6" />
          </div>

          <h1 className="text-2xl font-bold">EduEval AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accédez à votre évaluation
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations de l’étudiant</CardTitle>
            <CardDescription>
              Renseignez vos informations et le code communiqué par votre
              professeur.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  required
                  placeholder="Prénom"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                <Input
                  required
                  placeholder="Nom"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>

              <Input
                required
                type="email"
                placeholder="Adresse email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                required
                placeholder="Code de l’évaluation"
                className="uppercase"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? "Vérification..." : "Vérifier le code"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default StudentAccess;
