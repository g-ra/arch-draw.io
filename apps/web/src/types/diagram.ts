export type NodeCategory =
  | "network" | "backend" | "devops" | "frontend"
  | "database" | "queue" | "region" | "custom";

export interface NodeComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  resolved: boolean;
}

export interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "gRPC" | "WS";
  path: string;
  description?: string;
  requestBody?: string;
  responseBody?: string;
}

export interface BrokerTopic {
  id: string;
  name: string;
  direction: "in" | "out" | "both";
  messageType?: string;
  description?: string;
}

export interface TechNodeData {
  label: string;
  category: NodeCategory;
  icon?: string;
  description?: string;
  tech?: string;
  endpoints?: Endpoint[];
  topics?: BrokerTopic[];
  comments?: NodeComment[];
  isCustom?: boolean;
  customColor?: string;
  customIcon?: string;
  regionName?: string;
  regionColor?: string;
  zIndex?: number;
  // internal highlight state
  _highlighted?: boolean;
  _dimmed?: boolean;
}

// Sticky note
export interface StickyNoteData {
  text: string;
  colorName: string; // yellow | green | blue | pink | purple | orange | dark
  fontSize: number;
  author?: string;
}

// Free text annotation / heading
export interface TextAnnotationData {
  text: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  textAlign: "left" | "center" | "right";
}

export type FlowProtocol =
  | "HTTP" | "HTTPS" | "gRPC" | "TCP" | "UDP"
  | "AMQP" | "WebSocket" | "Kafka" | "NATS" | "custom";

export interface FlowEdgeData {
  label?: string;
  protocol?: FlowProtocol | string;
  animated?: boolean;
  animationSpeed?: "slow" | "normal" | "fast";
  color?: string;
  bidirectional?: boolean;
  description?: string;
  highlighted?: boolean;
  dimmed?: boolean;
}

export type EditorTool = "select" | "sticky" | "text" | "comment";

export interface MacroDefinition {
  id: string;
  name: string;
  tags: string[];
  nodes: import("reactflow").Node[];
  edges: import("reactflow").Edge[];
  createdAt: string;
  isLibrary?: boolean;
  libraryId?: string;
}
