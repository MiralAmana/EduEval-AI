import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function TakeEvaluation() {
  const [secondsRemaining, setSecondsRemaining] = useState(60 * 60);
  const [exitCount, setExitCount] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (blocked || secondsRemaining <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [blocked, secondsRemaining]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !blocked) {
        setExitCount((current) => {
          const nextCount = current + 1;

          if (nextCount >= 3) {
            setBlocked(true);
          }

          return nextCount;
        });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [blocked]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  if (blocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-7" />
            </div>

            <h1 className="text-2xl font-bold">Évaluation bloquée</h1>

            <p className="mt-3 text-muted-foreground">
              Vous avez quitté la fenêtre de l’évaluation trois fois. Cette
              tentative ne peut plus être reprise.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-semibold">Évaluation Word — Niveau 1</p>
            <p className="text-xs text-muted-foreground">Awa Ndiaye</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={exitCount >= 2 ? "destructive" : "secondary"}>
              Sorties : {exitCount}/3
            </Badge>

            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-semibold">
              <Clock3 className="size-4" />
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-6 py-10">
        {exitCount > 0 && (
          <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />

            <div>
              <p className="font-semibold">Attention</p>
              <p className="text-muted-foreground">
                Tout changement d’onglet est enregistré. À la troisième sortie,
                votre tentative sera définitivement bloquée.
              </p>
            </div>
          </div>
        )}

        {[1, 2, 3].map((question) => (
          <Card key={question}>
            <CardHeader>
              <CardTitle className="text-base">
                Question {question} — 5 points
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <p>
                Expliquez avec vos propres mots la notion demandée dans cette
                question.
              </p>

              <Textarea
                rows={5}
                placeholder="Écrivez votre réponse ici..."
              />
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end">
          <Button size="lg">Soumettre l’évaluation</Button>
        </div>
      </div>
    </main>
  );
}

export default TakeEvaluation;