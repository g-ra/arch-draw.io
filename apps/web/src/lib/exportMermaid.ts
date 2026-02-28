import { Node, Edge } from "reactflow";
import { TechNodeData, FlowEdgeData } from "../types/diagram";

const MERMAID_SHAPE: Record<string, [string, string]> = {
  network:  ["([", "])"],   // stadium
  backend:  ["[",  "]"],   // rectangle
  database: ["[(", ")]"],  // cylinder
  queue:    ["{{", "}}"],  // hexagon
  devops:   ["[[", "]]"],  // subroutine
  frontend: ["(",  ")"],   // round
  region:   ["[",  "]"],
  custom:   ["[",  "]"],
};

function safeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function nodeLabel(data: TechNodeData) {
  const lines = [data.label];
  if (data.tech) lines.push(data.tech);
  return lines.join("\\n");
}

export function toMermaid(nodes: Node<TechNodeData>[], edges: Edge<FlowEdgeData>[]): string {
  const lines: string[] = ["flowchart TD"];

  // Region subgraphs
  const regionNodes = nodes.filter((n) => n.type === "regionGroup");
  const techOnlyNodes = nodes.filter((n) => n.type === "techNode");
  const childrenOfRegion = new Set<string>();

  // Collect region children (nodes visually inside region bounds)
  for (const region of regionNodes) {
    const rx = region.position.x;
    const ry = region.position.y;
    const rw = (region.style?.width as number) || 400;
    const rh = (region.style?.height as number) || 300;

    const children = techOnlyNodes.filter(
      (n) =>
        n.position.x >= rx &&
        n.position.x <= rx + rw &&
        n.position.y >= ry &&
        n.position.y <= ry + rh
    );

    if (children.length > 0) {
      const regionData = region.data;
      lines.push(`\n    subgraph ${safeId(region.id)}["${regionData.regionName || regionData.label}"]`);
      for (const child of children) {
        const d = child.data;
        const [open, close] = MERMAID_SHAPE[d.category] || ["[", "]"];
        lines.push(`        ${safeId(child.id)}${open}"${nodeLabel(d)}"${close}`);
        childrenOfRegion.add(child.id);
      }
      lines.push("    end");
    }
  }

  // Standalone nodes
  const standaloneNodes = techOnlyNodes.filter(
    (n) => !childrenOfRegion.has(n.id)
  );

  if (standaloneNodes.length > 0) {
    lines.push("");
    for (const n of standaloneNodes) {
      const d = n.data;
      const [open, close] = MERMAID_SHAPE[d.category] || ["[", "]"];
      lines.push(`    ${safeId(n.id)}${open}"${nodeLabel(d)}"${close}`);
    }
  }

  // Edges
  if (edges.length > 0) {
    lines.push("");
    for (const e of edges) {
      const d = e.data || {};
      const label = d.label || d.protocol || "";
      const arrow = d.bidirectional ? "<-->" : "-->";
      const edgeLine = label
        ? `    ${safeId(e.source)} ${arrow}|"${label}"| ${safeId(e.target)}`
        : `    ${safeId(e.source)} ${arrow} ${safeId(e.target)}`;
      lines.push(edgeLine);
    }
  }

  // Endpoint annotations as comments
  const apiNodes = techOnlyNodes.filter(
    (n) => n.data.endpoints && n.data.endpoints.length > 0
  );
  if (apiNodes.length > 0) {
    lines.push("\n    %% API Endpoints");
    for (const n of apiNodes) {
      for (const ep of n.data.endpoints || []) {
        lines.push(`    %% ${n.data.label}: ${ep.method} ${ep.path}${ep.description ? " — " + ep.description : ""}`);
      }
    }
  }

  // Topic annotations
  const brokerNodes = techOnlyNodes.filter(
    (n) => n.data.topics && n.data.topics.length > 0
  );
  if (brokerNodes.length > 0) {
    lines.push("\n    %% Topics");
    for (const n of brokerNodes) {
      for (const t of n.data.topics || []) {
        lines.push(`    %% ${n.data.label}: [${t.direction.toUpperCase()}] ${t.name}${t.messageType ? " <" + t.messageType + ">" : ""}`);
      }
    }
  }

  return lines.join("\n");
}
