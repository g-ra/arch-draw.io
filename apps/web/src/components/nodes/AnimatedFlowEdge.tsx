import { memo } from "react";
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from "reactflow";
import { FlowEdgeData } from "../../types/diagram";

const SPEED_DURATION: Record<string, number> = {
  slow: 3,
  normal: 1.5,
  fast: 0.6,
};

export const PROTOCOL_COLORS: Record<string, string> = {
  HTTP:      "#60a5fa",
  HTTPS:     "#34d399",
  gRPC:      "#a78bfa",
  TCP:       "#fb923c",
  UDP:       "#f472b6",
  AMQP:      "#fbbf24",
  WebSocket: "#38bdf8",
  Kafka:     "#ef4444",
  NATS:      "#22c55e",
  custom:    "#94a3b8",
  default:   "#94a3b8",
};

export const AnimatedFlowEdge = memo((props: EdgeProps<FlowEdgeData>) => {
  const {
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, data, selected,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isAnimated = data?.animated !== false;
  const speed = data?.animationSpeed || "normal";
  const protocol = data?.protocol || "HTTP";
  const color = data?.color || PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS.default;
  const duration = SPEED_DURATION[speed] || 1.5;

  const isHighlighted = data?.highlighted;
  const isDimmed = data?.dimmed;

  const strokeColor = isHighlighted ? "#818cf8" : selected ? "#818cf8" : color;
  const strokeWidth = isHighlighted || selected ? 2.5 : 1.5;
  const opacity = isDimmed ? 0.1 : isHighlighted ? 1 : 0.7;

  // Unique marker IDs per edge so each can have its own color
  const markerEndId = `arrowend-${id}`;
  const markerStartId = `arrowstart-${id}`;

  return (
    <>
      {/* SVG marker definitions — use actual `color`, not `strokeColor`, so
          arrowheads always show the configured color even while edge is selected */}
      <defs>
        <marker
          id={markerEndId}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} opacity={opacity} />
        </marker>
        {data?.bidirectional && (
          <marker
            id={markerStartId}
            markerWidth="8"
            markerHeight="6"
            refX="1"
            refY="3"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 8 3, 0 6" fill={color} opacity={opacity} />
          </marker>
        )}
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: strokeColor, strokeWidth, opacity, transition: "all 0.2s" }}
        markerEnd={`url(#${markerEndId})`}
        markerStart={data?.bidirectional ? `url(#${markerStartId})` : undefined}
      />

      {/* Animated flow particle — pointer-events:none so clicking the particle
          still registers as clicking the edge */}
      {isAnimated && !isDimmed && (
        <path
          d={edgePath}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeDasharray={`6 ${duration * 60}`}
          strokeDashoffset={0}
          opacity={0.9}
          style={{
            animation: `flowDash ${duration}s linear infinite`,
            filter: `drop-shadow(0 0 3px ${color})`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Reverse flow for bidirectional */}
      {isAnimated && !isDimmed && data?.bidirectional && (
        <path
          d={edgePath}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeDasharray={`4 ${duration * 70}`}
          opacity={0.6}
          style={{
            animation: `flowDashReverse ${duration * 1.3}s linear infinite`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Label */}
      <EdgeLabelRenderer>
        {(data?.label || data?.protocol) && (
          <div
            className="absolute pointer-events-none"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, opacity }}
          >
            <span
              className="px-1.5 py-0.5 rounded text-xs font-mono font-medium"
              style={{
                background: "#1a1d2e",
                color: strokeColor,
                border: `1px solid ${strokeColor}44`,
              }}
            >
              {data?.label || data?.protocol}
            </span>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});

AnimatedFlowEdge.displayName = "AnimatedFlowEdge";
