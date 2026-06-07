import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Boxes,
  Brain,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Database,
  FileText,
  History,
  Lightbulb,
  Map,
  PenLine,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";
import { ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "../shared/api/commands";
import {
  projectLogReturnHref,
  useProjectNavigationStore
} from "./projectNavigationStore";
import storyforgeLogo from "../assets/storyforge-logo-source.png";

type ProjectShellProps = {
  projectId: string;
  activeSection: "concept" | "ai" | "aiLog";
  children: ReactNode;
};

const disabledSections = [
  { label: "Plan", icon: Map },
  { label: "Postacie", icon: Users },
  { label: "Świat", icon: Boxes },
  { label: "Rozdziały", icon: FileText },
  { label: "Edytor", icon: PenLine },
  { label: "Ciągłość", icon: Brain }
];

export function ProjectShell({
  projectId,
  activeSection,
  children
}: ProjectShellProps) {
  const navigate = useNavigate();
  const location = useLocation({
    select: (currentLocation) => ({
      href: currentLocation.href
    })
  });
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });
  const rememberLogReturnLocation = useProjectNavigationStore(
    (state) => state.rememberLogReturnLocation
  );
  const storedLogReturnLocation = useProjectNavigationStore(
    (state) => state.logReturnLocations[projectId]
  );

  const title =
    projectQuery.data?.book.workingTitle ||
    projectQuery.data?.project.name ||
    "Projekt";
  const subtitle =
    activeSection === "concept"
      ? "Faza 2: Koncepcja książki"
      : activeSection === "aiLog"
        ? "Log AI"
        : "Ustawienia AI";

  useEffect(() => {
    if (activeSection !== "aiLog") {
      rememberLogReturnLocation(projectId, location.href);
    }
  }, [activeSection, location.href, projectId, rememberLogReturnLocation]);

  function toggleAiLog() {
    if (activeSection === "aiLog") {
      void navigate({
        href: projectLogReturnHref(projectId, storedLogReturnLocation)
      });
      return;
    }

    rememberLogReturnLocation(projectId, location.href);
    void navigate({
      to: "/projects/$projectId/ai-log",
      params: { projectId }
    });
  }

  return (
    <div className="project-shell">
      <aside className="sidebar">
        <Link className="brand-link" to="/">
          <span className="brand-mark">
            <img src={storyforgeLogo} alt="" />
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label="Etapy pisania">
          <Link
            to="/projects/$projectId/concept"
            params={{ projectId }}
            className={activeSection === "concept" ? "nav-item active" : "nav-item"}
          >
            <Lightbulb size={18} />
            Koncepcja
          </Link>

          {disabledSections.map(({ label, icon: Icon }) => (
            <span className="nav-item disabled" key={label}>
              <Icon size={18} />
              {label}
            </span>
          ))}
        </nav>

        <div className="sidebar-bottom-nav">
          <Link
            to="/projects/$projectId/ai"
            params={{ projectId }}
            className={activeSection === "ai" ? "nav-item active" : "nav-item"}
          >
            <ShieldCheck size={18} />
            AI
          </Link>
          <button
            type="button"
            className={activeSection === "aiLog" ? "nav-item active" : "nav-item"}
            title={activeSection === "aiLog" ? "Zamknij log AI" : "Otwórz log AI"}
            onClick={toggleAiLog}
          >
            <History size={18} />
            Log AI
          </button>
          <span className="nav-item disabled">
            <Settings size={18} />
            Ustawienia
          </span>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div>
            <h1>Projekt: {title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="workspace-header-actions" aria-label="Status projektu">
            <span className="autosave-status">
              <CheckCircle2 size={16} />
              Zapisano automatycznie • 10:42
            </span>
            <button type="button" className="topbar-select">
              <Database size={16} />
              Lokalny SQLite
              <ChevronDown size={15} />
            </button>
            <button
              type="button"
              className={projectQuery.isError ? "topbar-select muted" : "topbar-select ready"}
            >
              {projectQuery.isError ? <CircleDot size={16} /> : <CheckCircle2 size={16} />}
              {projectQuery.isError ? "Błąd danych" : "Gotowy"}
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <main className="workspace-main">{children}</main>
      </div>
    </div>
  );
}
