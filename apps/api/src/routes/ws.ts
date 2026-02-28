import { FastifyInstance } from "fastify";

// Комнаты: diagramId -> Set<any>
const rooms = new Map<string, Set<any>>();

// Presence: diagramId -> Map<userId, { name, color, socket }>
interface UserPresence {
  userId: string;
  userName: string;
  color: string;
  socket: any;
  cursor?: { x: number; y: number };
}

const presence = new Map<string, Map<string, UserPresence>>();

const USER_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4",
];

export async function wsRoutes(app: FastifyInstance) {
  app.get<{ Params: { diagramId: string } }>(
    "/diagram/:diagramId",
    { websocket: true },
    (socket, req) => {
      const { diagramId } = req.params as { diagramId: string };

      if (!rooms.has(diagramId)) rooms.set(diagramId, new Set());
      rooms.get(diagramId)!.add(socket);

      socket.on("message", (raw: Buffer) => {
        const room = rooms.get(diagramId);
        if (!room) return;

        // Parse and re-stringify to ensure JSON format
        try {
          const msg = JSON.parse(raw.toString());
          const jsonString = JSON.stringify(msg);

          // Broadcast to all except sender
          for (const client of room) {
            if (client !== socket && client.readyState === 1) {
              client.send(jsonString);
            }
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      });

      socket.on("close", () => {
        rooms.get(diagramId)?.delete(socket);
        if (rooms.get(diagramId)?.size === 0) rooms.delete(diagramId);
      });
    }
  );

  // Presence WebSocket для показа активных пользователей
  app.get<{ Params: { diagramId: string } }>(
    "/presence/:diagramId",
    { websocket: true },
    (socket, req) => {
      const { diagramId } = req.params as { diagramId: string };

      if (!presence.has(diagramId)) {
        presence.set(diagramId, new Map());
      }

      const room = presence.get(diagramId)!;
      let currentUserId: string | null = null;

      socket.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.type === "join" && msg.userId) {
            // Пользователь присоединился
            const userId = msg.userId as string;
            currentUserId = userId;
            const usedColors = Array.from(room.values()).map((u) => u.color);
            const availableColor = USER_COLORS.find((c) => !usedColors.includes(c)) || USER_COLORS[0];

            room.set(userId, {
              userId: userId,
              userName: msg.userName || "Anonymous",
              color: availableColor,
              socket,
            });

            // Отправляем список всех пользователей всем в комнате
            broadcastUsers(diagramId);
          } else if (msg.type === "cursor" && currentUserId) {
            // Обновление позиции курсора
            const user = room.get(currentUserId);
            if (user) {
              user.cursor = msg.position;

              // Отправляем позицию курсора всем кроме отправителя
              for (const [uid, u] of room) {
                if (uid !== currentUserId && u.socket.readyState === 1) {
                  u.socket.send(JSON.stringify({
                    type: "cursor",
                    userId: currentUserId,
                    position: msg.position,
                  }));
                }
              }
            }
          }
        } catch (err) {
          console.error("WS presence error:", err);
        }
      });

      socket.on("close", () => {
        if (currentUserId) {
          room.delete(currentUserId);
          broadcastUsers(diagramId);
        }
        if (room.size === 0) {
          presence.delete(diagramId);
        }
      });
    }
  );

  function broadcastUsers(diagramId: string) {
    const room = presence.get(diagramId);
    if (!room) return;

    const users = Array.from(room.values()).map((u) => ({
      id: u.userId,
      name: u.userName,
      color: u.color,
      cursor: u.cursor,
    }));

    const message = JSON.stringify({ type: "users", users });

    for (const user of room.values()) {
      if (user.socket.readyState === 1) {
        user.socket.send(message);
      }
    }
  }
}

