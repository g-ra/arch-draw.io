import { useState, useEffect } from "react";
import { MessageSquare, Smile, Trash2, CheckCircle, Circle, Send } from "lucide-react";

interface Comment {
  id: string;
  diagramId: string;
  authorId: string;
  content?: string;
  audioUrl?: string;
  type: "text" | "voice";
  nodeId?: string;
  posX?: number;
  posY?: number;
  parentId?: string;
  resolved: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  reactions: Array<{
    id: string;
    emoji: string;
    userId: string;
    user: {
      id: string;
      name: string;
    };
  }>;
  replies?: Comment[];
}

interface Props {
  diagramId: string;
  currentUserId?: string;
  onClose: () => void;
}

export function CommentsPanel({ diagramId, currentUserId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");

  useEffect(() => {
    loadComments();
  }, [diagramId]);

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/comments?diagramId=${diagramId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          diagramId,
          content: newComment,
          type: "text",
          parentId: replyTo,
        }),
      });

      if (res.ok) {
        setNewComment("");
        setReplyTo(null);
        loadComments();
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    try {
      await fetch(`/api/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emoji }),
      });
      loadComments();
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  const toggleResolved = async (commentId: string, resolved: boolean) => {
    try {
      await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resolved: !resolved }),
      });
      loadComments();
    } catch (err) {
      console.error("Failed to toggle resolved:", err);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;

    try {
      await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      loadComments();
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  // Filter comments
  const topLevelComments = comments.filter((c) => !c.parentId);
  const filteredComments = topLevelComments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  // Group reactions by emoji
  const groupReactions = (reactions: Comment["reactions"]) => {
    const grouped = new Map<string, { count: number; userIds: string[] }>();
    reactions.forEach((r) => {
      const existing = grouped.get(r.emoji) || { count: 0, userIds: [] };
      grouped.set(r.emoji, {
        count: existing.count + 1,
        userIds: [...existing.userIds, r.userId],
      });
    });
    return grouped;
  };

  return (
    <div className="w-80 bg-[#13151f] border-l border-[#2d3148] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3148]">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-indigo-400" />
          <h3 className="text-white font-semibold">Comments</h3>
          <span className="text-xs text-slate-500">
            ({filteredComments.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white text-lg"
        >
          ✕
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-[#2d3148]">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 px-4 py-2 text-sm transition-colors ${
              filter === f
                ? "text-indigo-400 border-b-2 border-indigo-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-slate-500 py-8">Loading...</div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            No {filter !== "all" && filter} comments yet
          </div>
        ) : (
          filteredComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onReply={() => setReplyTo(comment.id)}
              onReaction={(emoji) => toggleReaction(comment.id, emoji)}
              onToggleResolved={() =>
                toggleResolved(comment.id, comment.resolved)
              }
              onDelete={() => deleteComment(comment.id)}
              groupReactions={groupReactions}
            />
          ))
        )}
      </div>

      {/* New comment input */}
      <div className="border-t border-[#2d3148] p-4">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <span>Replying to comment...</span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-slate-500 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addComment()}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={addComment}
            disabled={!newComment.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onReaction,
  onToggleResolved,
  onDelete,
  groupReactions,
}: {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onReaction: (emoji: string) => void;
  onToggleResolved: () => void;
  onDelete: () => void;
  groupReactions: (reactions: Comment["reactions"]) => Map<string, { count: number; userIds: string[] }>;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const reactions = groupReactions(comment.reactions);
  const isAuthor = currentUserId === comment.authorId;

  const emojis = ["👍", "❤️", "😄", "🎉", "🤔", "👀"];

  return (
    <div
      className={`rounded-lg p-3 ${
        comment.resolved ? "bg-[#0f1117] opacity-60" : "bg-[#1a1d2e]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white font-semibold">
            {comment.author.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              {comment.author.name}
            </div>
            <div className="text-xs text-slate-500">
              {new Date(comment.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleResolved}
            title={comment.resolved ? "Mark as open" : "Mark as resolved"}
            className="text-slate-500 hover:text-white"
          >
            {comment.resolved ? (
              <CheckCircle size={14} className="text-green-400" />
            ) : (
              <Circle size={14} />
            )}
          </button>
          {isAuthor && (
            <button
              onClick={onDelete}
              className="text-slate-500 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {comment.content && (
        <p className="text-sm text-slate-300 mb-2 whitespace-pre-wrap">
          {comment.content}
        </p>
      )}

      {comment.audioUrl && (
        <audio controls className="w-full mb-2">
          <source src={comment.audioUrl} />
        </audio>
      )}

      {/* Reactions */}
      {reactions.size > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {Array.from(reactions.entries()).map(([emoji, data]) => (
            <button
              key={emoji}
              onClick={() => onReaction(emoji)}
              className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors ${
                data.userIds.includes(currentUserId || "")
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-[#0f1117] text-slate-400 hover:bg-[#252836]"
              }`}
            >
              <span>{emoji}</span>
              <span>{data.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 text-xs">
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex items-center gap-1 text-slate-500 hover:text-white transition-colors"
          >
            <Smile size={12} /> React
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-1 bg-[#1a1d2e] border border-[#2d3148] rounded-lg p-2 flex gap-1 z-10">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReaction(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onReply}
          className="text-slate-500 hover:text-white transition-colors"
        >
          Reply
        </button>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-[#2d3148] space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white font-semibold">
                  {reply.author.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white font-medium">
                  {reply.author.name}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(reply.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-slate-300 ml-7">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
