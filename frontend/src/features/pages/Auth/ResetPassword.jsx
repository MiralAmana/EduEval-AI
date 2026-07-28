import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpenCheck, Eye, EyeOff } from "lucide-react";

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
import {
  PASSWORD_STRENGTH_LEVELS,
  getPasswordStrength,
} from "@/lib/passwordStrength";
import { resetPassword } from "@/services/auth.service";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);

    try {
      await resetPassword({ token, password });

      navigate("/login", {
        replace: true,
        state: { message: "Mot de passe mis à jour, tu peux te connecter." },
      });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "Impossible de réinitialiser le mot de passe."
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
            Choisis un nouveau mot de passe
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau mot de passe</CardTitle>
            <CardDescription>
              Ce lien n’est valable qu’une heure après son envoi.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!token ? (
              <p className="text-sm text-muted-foreground">
                Ce lien de réinitialisation est invalide.{" "}
                <Link to="/forgot-password" className="font-medium text-primary">
                  Redemander un email
                </Link>
                .
              </p>
            ) : (
              <form className="space-y-4" noValidate onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
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
                        {PASSWORD_STRENGTH_LEVELS.slice(1).map(
                          (level, index) => (
                            <div
                              key={level.label}
                              className={[
                                "h-1 flex-1 rounded-full transition-colors",
                                index <
                                PASSWORD_STRENGTH_LEVELS.indexOf(
                                  passwordStrength
                                )
                                  ? passwordStrength.className
                                  : "bg-muted",
                              ].join(" ")}
                            />
                          )
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Solidité : {passwordStrength.label}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      8 caractères minimum.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">
                    Confirme le mot de passe
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button className="w-full" type="submit" disabled={submitting}>
                  {submitting ? "Mise à jour..." : "Mettre à jour le mot de passe"}
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

export default ResetPassword;
