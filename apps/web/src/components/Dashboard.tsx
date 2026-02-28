import { useEffect, useState } from "react";
import { Plus, LogOut, FileEdit, Trash2 } from "lucide-react";

interface Diagram {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
}

interface Props {
  user: { id: string; name: string; email: string };
  onOpenDiagram: (id: string) => void;
  onLogout: () => void;
}

export function Dashboard({ user, onOpenDiagram, onLogout }: Props) {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    const res = await fetch("/api/diagrams", { credentials: "include" });
    if (res.ok) setDiagrams(await res.json());
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/diagrams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newName, data: { nodes: [], edges: [] } }),
    });
    if (res.ok) {
      const diagram = await res.json();
      setCreating(false);
      setNewName("");
      onOpenDiagram(diagram.id);
    }
  };

  const deleteDiagram = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this diagram?")) return;
    await fetch(`/api/diagrams/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    onLogout();
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <header className="border-b border-[#2d3148] px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">TechFlow</h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{user.name}</span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white">My Diagrams</h2>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus size={16} /> New Diagram
          </button>
        </div>

        {/* Create modal */}
        {creating && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl p-6 w-full max-w-md">
              <h3 className="text-white font-semibold mb-4">New Diagram</h3>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Diagram name..."
                className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setCreating(false)} className="px-4 py-2 text-slate-400 hover:text-white">
                  Cancel
                </button>
                <button onClick={create} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500">
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diagram grid */}
        {diagrams.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <FileEdit size={48} className="mx-auto mb-4 opacity-30" />
            <p>No diagrams yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {diagrams.map((d) => (
              <div
                key={d.id}
                onClick={() => onOpenDiagram(d.id)}
                className="group cursor-pointer rounded-xl border border-[#2d3148] bg-[#1a1d2e] p-5 hover:border-indigo-500 transition-all"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-white font-medium truncate flex-1">{d.name}</h3>
                  <button
                    onClick={(e) => deleteDiagram(d.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all ml-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {d.description && (
                  <p className="text-slate-400 text-sm mt-1 truncate">{d.description}</p>
                )}
                <p className="text-slate-600 text-xs mt-3">
                  {new Date(d.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
