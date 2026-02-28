import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

interface Props {
  diagramId: string;
  currentUserName: string;
}

const USER_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
];

export function UserPresence({ diagramId, currentUserName }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [userId] = useState(() => {
    const stored = localStorage.getItem("tf_user_id");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem("tf_user_id", newId);
    return newId;
  });

  // Create WebSocket connection once
  useEffect(() => {
    const socket = new WebSocket(`ws://${location.host}/ws/presence/${diagramId}`);
    setWs(socket);

    socket.onopen = () => {
      // Announce presence
      socket.send(JSON.stringify({
        type: "join",
        userId,
        userName: currentUserName || "Anonymous",
      }));
    };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === "users") {
        // Update user list
        setUsers(msg.users.filter((u: User) => u.id !== userId));
      } else if (msg.type === "cursor") {
        // Update cursor position
        setUsers((prev) =>
          prev.map((u) =>
            u.id === msg.userId ? { ...u, cursor: msg.position } : u
          )
        );
      }
    };

    // Send cursor position
    const handleMouseMove = (e: MouseEvent) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "cursor",
          userId,
          position: { x: e.clientX, y: e.clientY },
        }));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      socket.close();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [diagramId, userId]);

  // Update username when it changes
  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "join",
        userId,
        userName: currentUserName || "Anonymous",
      }));
    }
  }, [currentUserName, ws, userId]);

  return (
    <>
      {/* Active users list */}
      {users.length > 0 && (
        <div className="fixed top-16 left-4 bg-[#1a1d2e] border border-[#2d3148] rounded-lg shadow-xl p-3 z-50">
          <div className="text-xs text-slate-400 mb-2 font-medium">Active Users ({users.length})</div>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-sm text-white">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remote cursors */}
      {users.map((user) =>
        user.cursor ? (
          <div
            key={user.id}
            className="fixed pointer-events-none z-[9999] transition-all duration-100"
            style={{
              left: user.cursor.x,
              top: user.cursor.y,
              transform: "translate(-2px, -2px)",
            }}
          >
            <MousePointer2
              size={20}
              style={{ color: user.color }}
              fill={user.color}
            />
            <div
              className="mt-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
              style={{
                backgroundColor: user.color,
                color: "white",
              }}
            >
              {user.name}
            </div>
          </div>
        ) : null
      )}
    </>
  );
}
