import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Evaluations from "@/features/pages/Evaluations";
import EvaluationEdit from "@/features/pages/EvaluationEdit";

import AiCreate from "@/features/pages/Evaluation/AiCreate";
import CreateChoice from "@/features/pages/Evaluation/CreateChoice";
import EvaluationDetails from "@/features/pages/Evaluation/EvaluationDetails";
import ManualCreate from "@/features/pages/Evaluation/ManualCreate";
import PdfImport from "@/features/pages/Evaluation/PdfImport";

/**
 * Page affichée lorsqu'aucune route ne correspond.
 */
function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-primary">
          Erreur 404
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Page introuvable
        </h1>

        <p className="mt-3 text-muted-foreground">
          La page demandée n’existe pas ou a été déplacée.
        </p>

        <a
          href="/evaluations"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Retour aux évaluations
        </a>
      </div>
    </main>
  );
}

/**
 * Layout principal temporaire.
 *
 * Tu pourras remplacer cette structure plus tard par ton
 * DashboardLayout avec sidebar et navbar.
 */
function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/evaluations"
            className="text-xl font-bold tracking-tight"
          >
            EduEval AI
          </a>

          <nav className="flex items-center gap-4">
            <a
              href="/evaluations"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Évaluations
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirection de la racine */}

        <Route
          path="/"
          element={
            <Navigate
              to="/evaluations"
              replace
            />
          }
        />

        {/* Liste des évaluations */}

        <Route
          path="/evaluations"
          element={
            <AppLayout>
              <Evaluations />
            </AppLayout>
          }
        />

        {/* Choix du type et du mode de création */}

        <Route
          path="/evaluations/create"
          element={
            <AppLayout>
              <CreateChoice />
            </AppLayout>
          }
        />

        {/* Création manuelle */}

        <Route
          path="/evaluations/create/manual"
          element={
            <AppLayout>
              <ManualCreate />
            </AppLayout>
          }
        />

        {/* Création depuis un PDF */}

        <Route
          path="/evaluations/create/pdf"
          element={
            <AppLayout>
              <PdfImport />
            </AppLayout>
          }
        />

        {/* Création avec l'IA */}

        <Route
          path="/evaluations/create/ai"
          element={
            <AppLayout>
              <AiCreate />
            </AppLayout>
          }
        />

        {/* Modification d'une évaluation */}

        <Route
          path="/evaluations/:id/edit"
          element={
            <AppLayout>
              <EvaluationEdit />
            </AppLayout>
          }
        />

        {/* Détails d'une évaluation */}

        <Route
          path="/evaluations/:id"
          element={
            <AppLayout>
              <EvaluationDetails />
            </AppLayout>
          }
        />

        {/* Page inexistante */}

        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}