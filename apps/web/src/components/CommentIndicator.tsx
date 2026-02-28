import { MessageSquare } from "lucide-react";

interface Props {
  x: number;
  y: number;
  count: number;
  onClick: () => void;
}

export function CommentIndicator({ x, y, count, onClick }: Props) {
  return (
    <div
      className="absolute pointer-events-auto cursor-pointer"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -50%)",
      }}
      onClick={onClick}
    >
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg hover:bg-amber-400 transition-colors">
          <MessageSquare size={16} className="text-white" />
        </div>
        {count > 1 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold text-white">
            {count}
          </div>
        )}
      </div>
    </div>
  );
}
