import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/services/auth.service";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await requestPasswordReset(email);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
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
            Réinitialise ton mot de passe
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mot de passe oublié</CardTitle>
            <CardDescription>
              Renseigne ton email, on t’envoie un lien pour en choisir un
              nouveau.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <p className="text-sm text-muted-foreground">
                Si un compte existe avec cet email, un lien de
                réinitialisation vient d’être envoyé. Vérifie ta boîte de
                réception (et tes spams).
              </p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <Button className="w-full" type="submit" disabled={submitting}>
                  {submitting ? "Envoi..." : "Envoyer le lien"}
                </Button>
              </form>
            )}

            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary">
                Retour à la connexion
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default ForgotPassword;
