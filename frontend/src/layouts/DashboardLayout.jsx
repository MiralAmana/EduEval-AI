import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  BookOpenCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";

const navigation = [
  {
    label: "Tableau de bord",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Évaluations",
    path: "/evaluations",
    icon: BookOpenCheck,
  },
  {
    label: "Étudiants",
    path: "/students",
    icon: GraduationCap,
  },
  {
    label: "Résultats",
    path: "/results",
    icon: BarChart3,
  },
];

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background lg:flex lg:flex-col">
        <div className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenCheck className="size-5" />
            </div>

            <div>
              <p className="font-semibold">EduEval AI</p>
              <p className="text-xs text-muted-foreground">
                Gestion des évaluations
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-4">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <Settings className="size-4" />
            Paramètres
          </button>

          <button className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="size-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
          <div>
            <p className="text-sm font-medium">Espace professeur</p>
            <p className="text-xs text-muted-foreground">
              Gérez vos exercices et évaluations
            </p>
          </div>

          <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            CA
          </div>
        </header>

        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;