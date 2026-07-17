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

function StudentAccess() {
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    navigate("/evaluation/demo");
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
                <Input required placeholder="Prénom" />
                <Input required placeholder="Nom" />
              </div>

              <Input required type="email" placeholder="Adresse email" />
              <Input
                required
                placeholder="Code de l’évaluation"
                className="uppercase"
              />

              <Button className="w-full" type="submit">
                Vérifier le code
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default StudentAccess;