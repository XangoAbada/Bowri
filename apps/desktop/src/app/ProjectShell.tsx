import { Link } from "@tanstack/react-router";
import { BookOpen, Boxes, Brain, FileText, Map, PenLine, Settings, Users } from "lucide-react";
import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "../shared/api/commands";
import { AiProposalPanel } from "../features/ai/AiProposalPanel";
import { CodexStatusPanel } from "../features/ai/CodexStatusPanel";

type ProjectShellProps = {
  projectId: string;
  activeSection: "concept" | "ai";
  children: ReactNode;
};

const disabledSections = [
  { label: "Plan", icon: Map },
  { label: "Postacie", icon: Users },
  { label: "Swiat", icon: Boxes },
  { label: "Rozdzialy", icon: FileText },
  { label: "Edytor", icon: PenLine },
  { label: "Ciaglosc", icon: Brain }
];

export function ProjectShell({
  projectId,
  activeSection,
  children
}: ProjectShellProps) {
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });

  const title =
    projectQuery.data?.book.workingTitle ||
    projectQuery.data?.project.name ||
    "Projekt";

  return (
    <div className="project-shell">
      <aside className="sidebar">
        <Link className="brand-link" to="/">
          <span>SF2</span>
          <strong>StoryForge2</strong>
        </Link>

        <nav className="sidebar-nav" aria-label="Etapy pisania">
          <Link
            to="/projects/$projectId/concept"
            params={{ projectId }}
            className={activeSection === "concept" ? "nav-item active" : "nav-item"}
          >
            <BookOpen size={17} />
            Koncepcja
          </Link>

          {disabledSections.map(({ label, icon: Icon }) => (
            <span className="nav-item disabled" key={label}>
              <Icon size={17} />
              {label}
            </span>
          ))}
        </nav>

        <Link
          to="/projects/$projectId/ai"
          params={{ projectId }}
          className={activeSection === "ai" ? "nav-item active bottom" : "nav-item bottom"}
        >
          <Settings size={17} />
          AI
        </Link>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Projekt</p>
            <h1>{title}</h1>
          </div>
          {projectQuery.isError ? (
            <span className="status-pill muted">blad danych</span>
          ) : (
            <span className="status-pill">lokalny SQLite</span>
          )}
        </header>

        <main className="workspace-main">{children}</main>
      </div>

      <aside className="context-panel">
        <CodexStatusPanel compact />
        <AiProposalPanel projectId={projectId} />
      </aside>
    </div>
  );
}
