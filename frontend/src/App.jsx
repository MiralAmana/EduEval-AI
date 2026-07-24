import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthProvider, useAuth } from "@/context/AuthContext";

import Evaluations from "@/features/pages/Evaluations";
import EvaluationEdit from "@/features/pages/EvaluationEdit";
import Students from "@/features/pages/Students";

import AiCreate from "@/features/pages/Evaluation/AiCreate";
import CreateChoice from "@/features/pages/Evaluation/CreateChoice";
import EvaluationDetails from "@/features/pages/Evaluation/EvaluationDetails";
import AttemptReview from "@/features/pages/Evaluation/AttemptReview";
import ManualCreate from "@/features/pages/Evaluation/ManualCreate";
import PdfImport from "@/features/pages/Evaluation/PdfImport";
import Login from "@/features/pages/Auth/Login";
import Register from "@/features/pages/Auth/Register";
import StudentAccess from "@/features/pages/StudentAccess";
import TakeEvaluation from "@/features/pages/TakeEvaluation";

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

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

            <a
              href="/students"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Étudiants
            </a>

            {user && (
              <>
                <span className="text-sm text-muted-foreground">
                  {user.firstName} {user.lastName}
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Déconnexion
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

/**
 * Protège une route : redirige vers /login si l'utilisateur
 * n'est pas authentifié.
 */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}

function AppRoutes() {
  return (
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

      {/* Authentification */}

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Accès étudiant */}

      <Route path="/access" element={<StudentAccess />} />
      <Route path="/evaluation/:attemptId" element={<TakeEvaluation />} />

      {/* Liste des évaluations */}

      <Route
        path="/evaluations"
        element={
          <RequireAuth>
            <AppLayout>
              <Evaluations />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Étudiants, toutes évaluations confondues */}

      <Route
        path="/students"
        element={
          <RequireAuth>
            <AppLayout>
              <Students />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Choix du type et du mode de création */}

      <Route
        path="/evaluations/create"
        element={
          <RequireAuth>
            <AppLayout>
              <CreateChoice />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Création manuelle */}

      <Route
        path="/evaluations/create/manual"
        element={
          <RequireAuth>
            <AppLayout>
              <ManualCreate />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Création depuis un PDF */}

      <Route
        path="/evaluations/create/pdf"
        element={
          <RequireAuth>
            <AppLayout>
              <PdfImport />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Création avec l'IA */}

      <Route
        path="/evaluations/create/ai"
        element={
          <RequireAuth>
            <AppLayout>
              <AiCreate />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Modification d'une évaluation */}

      <Route
        path="/evaluations/:id/edit"
        element={
          <RequireAuth>
            <AppLayout>
              <EvaluationEdit />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Détails d'une évaluation */}

      <Route
        path="/evaluations/:id"
        element={
          <RequireAuth>
            <AppLayout>
              <EvaluationDetails />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Correction d'une tentative */}

      <Route
        path="/evaluations/:id/attempts/:attemptId"
        element={
          <RequireAuth>
            <AppLayout>
              <AttemptReview />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Page inexistante */}

      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}