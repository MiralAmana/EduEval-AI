import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpenCheck, Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
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

const PASSWORD_STRENGTH_LEVELS = [
  { label: "Trop court", className: "bg-destructive" },
  { label: "Faible", className: "bg-destructive" },
  { label: "Moyen", className: "bg-amber-500" },
  { label: "Bon", className: "bg-amber-500" },
  { label: "Fort", className: "bg-emerald-500" },
];

function getPasswordStrength(password) {
  if (!password) {
    return null;
  }

  if (password.length < 8) {
    return PASSWORD_STRENGTH_LEVELS[0];
  }

  let score = 1;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  }

  return PASSWORD_STRENGTH_LEVELS[score];
}

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!firstName.trim()) {
      setError("Le prénom est obligatoire.");
      return;
    }

    if (!lastName.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("L’email est invalide.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setSubmitting(true);

    try {
      await register({ firstName, lastName, email, password });

      navigate("/evaluations", { replace: true });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "Impossible de créer le compte."
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
            Crée ton espace enseignant
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inscription</CardTitle>
            <CardDescription>
              Renseigne tes informations pour créer ton compte.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" noValidate onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
              </div>

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

              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    className="pr-9"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>

                {passwordStrength ? (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {PASSWORD_STRENGTH_LEVELS.slice(1).map((level, index) => (
                        <div
                          key={level.label}
                          className={[
                            "h-1 flex-1 rounded-full transition-colors",
                            index <
                            PASSWORD_STRENGTH_LEVELS.indexOf(passwordStrength)
                              ? passwordStrength.className
                              : "bg-muted",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Solidité : {passwordStrength.label} (8 caractères
                      minimum, mélangez majuscules, chiffres et symboles pour
                      la renforcer)
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    8 caractères minimum.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? "Création..." : "Créer mon compte"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <Link to="/login" className="font-medium text-primary">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default Register;
