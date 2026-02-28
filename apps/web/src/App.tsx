import { useEffect, useState } from "react";
import { DiagramEditor } from "./components/DiagramEditor";
import { LoginPage } from "./components/LoginPage";

type Page = "login" | "editor";

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);

  useEffect(() => {
    // Check if URL is /editor/:diagramId (guest access)
    const path = window.location.pathname;
    const editorMatch = path.match(/^\/editor\/([a-zA-Z0-9_-]+)$/);

    if (editorMatch) {
      // Guest trying to open diagram directly
      const diagramId = editorMatch[1];

      // Check if user is authenticated
      fetch("/api/auth/me", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((u) => {
          if (u) {
            // Authenticated user - open editor directly
            setUser(u);
            setActiveDiagramId(diagramId);
            setPage("editor");
          } else {
            // Guest - open editor (will show guest modal inside)
            setActiveDiagramId(diagramId);
            setPage("editor");
          }
        });
      return;
    }

    // Normal auth flow - go directly to editor
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u);
          setActiveDiagramId(null); // Start with unsaved diagram
          setPage("editor");
        }
      });
  }, []);

  if (page === "login") {
    return (
      <LoginPage
        onLogin={(u) => {
          setUser(u);
          setActiveDiagramId(null); // Start with unsaved diagram
          setPage("editor");
        }}
      />
    );
  }

  return (
    <DiagramEditor
      diagramId={activeDiagramId}
      currentUser={user}
      onBack={() => {
        setUser(null);
        setActiveDiagramId(null);
        setPage("login");
      }}
    />
  );
}
