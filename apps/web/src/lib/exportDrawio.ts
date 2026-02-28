import { Node, Edge } from "reactflow";
import { TechNodeData, FlowEdgeData } from "../types/diagram";

const DRAWIO_STYLES: Record<string, string> = {
  network:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;",
  backend:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;",
  database:
    "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;",
  queue:
    "rhombus;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontStyle=1;",
  devops:
    "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontStyle=1;",
  frontend:
    "ellipse;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontStyle=1;",
  region:
    "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];shape=table;html=1;whiteSpace=wrap;startSize=30;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;dashed=1;",
  custom:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;",
};

const PROTOCOL_COLORS_HEX: Record<string, string> = {
  HTTP: "#6c8ebf",
  HTTPS: "#82b366",
  gRPC: "#9673a6",
  TCP: "#d79b00",
  UDP: "#d79b00",
  AMQP: "#d6b656",
  WebSocket: "#67ab9f",
  Kafka: "#b85450",
  NATS: "#82b366",
};

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodeValue(data: TechNodeData): string {
  const parts = [`<b>${escapeXml(data.label)}</b>`];
  if (data.tech) parts.push(`<i>${escapeXml(data.tech)}</i>`);
  if (data.description) parts.push(escapeXml(data.description));

  if (data.endpoints && data.endpoints.length > 0) {
    parts.push("<hr/>");
    for (const ep of data.endpoints) {
      parts.push(`<font color="${getMethodColor(ep.method)}"><b>${ep.method}</b></font> ${escapeXml(ep.path)}`);
      if (ep.description) parts.push(`<font color="#666">${escapeXml(ep.description)}</font>`);
    }
  }

  if (data.topics && data.topics.length > 0) {
    parts.push("<hr/>");
    for (const t of data.topics) {
      const dirColor = t.direction === "in" ? "#82b366" : t.direction === "out" ? "#b85450" : "#d6b656";
      parts.push(`<font color="${dirColor}"><b>[${t.direction.toUpperCase()}]</b></font> ${escapeXml(t.name)}`);
      if (t.messageType) parts.push(`<font color="#666">&lt;${escapeXml(t.messageType)}&gt;</font>`);
    }
  }

  return parts.join("<br/>");
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: "#82b366", POST: "#6c8ebf", PUT: "#d6b656",
    PATCH: "#d79b00", DELETE: "#b85450", gRPC: "#9673a6", WS: "#67ab9f",
  };
  return colors[method] || "#666666";
}

export function toDrawio(nodes: Node<TechNodeData>[], edges: Edge<FlowEdgeData>[]): string {
  const cells: string[] = [];
  let cellId = 2; // 0 and 1 are reserved by draw.io

  const nodeIdMap = new Map<string, number>();

  // Region groups first (rendered behind)
  const exportableNodes = nodes.filter(
    (n) => n.type === "regionGroup" || n.type === "techNode"
  );
  const regionNodes = exportableNodes.filter((n) => n.type === "regionGroup");
  const techNodes = exportableNodes.filter((n) => n.type === "techNode");

  for (const n of [...regionNodes, ...techNodes]) {
    const id = cellId++;
    nodeIdMap.set(n.id, id);
    const d = n.data;

    const w = n.type === "regionGroup"
      ? ((n.style?.width as number) || 400)
      : d.endpoints && d.endpoints.length > 0
        ? 180
        : 140;

    const baseH = n.type === "regionGroup"
      ? ((n.style?.height as number) || 300)
      : 60;
    const epH = d.endpoints ? d.endpoints.length * 18 : 0;
    const topicH = d.topics ? d.topics.length * 18 : 0;
    const h = baseH + epH + topicH;

    const style = n.type === "regionGroup"
      ? DRAWIO_STYLES.region
      : (DRAWIO_STYLES[d.category] || DRAWIO_STYLES.custom);

    const value = n.type === "regionGroup"
      ? `<b>🌍 ${escapeXml(d.regionName || d.label)}</b>${d.description ? "<br/><i>" + escapeXml(d.description) + "</i>" : ""}`
      : nodeValue(d);

    cells.push(
      `<mxCell id="${id}" value="${escapeXml(value)}" style="${style}" vertex="1" parent="1">` +
      `<mxGeometry x="${n.position.x}" y="${n.position.y}" width="${w}" height="${h}" as="geometry" />` +
      `</mxCell>`
    );
  }

  // Edges
  for (const e of edges) {
    const id = cellId++;
    const srcId = nodeIdMap.get(e.source);
    const tgtId = nodeIdMap.get(e.target);
    if (!srcId || !tgtId) continue;

    const d = e.data || {};
    const label = d.label || d.protocol || "";
    const color = PROTOCOL_COLORS_HEX[d.protocol || ""] || "#6c8ebf";
    const style = d.bidirectional
      ? `edgeStyle=orthogonalEdgeStyle;rounded=1;startArrow=block;startFill=0;endArrow=block;endFill=0;strokeColor=${color};`
      : `edgeStyle=orthogonalEdgeStyle;rounded=1;endArrow=block;endFill=1;strokeColor=${color};`;

    cells.push(
      `<mxCell id="${id}" value="${escapeXml(label)}" style="${style}" edge="1" source="${srcId}" target="${tgtId}" parent="1">` +
      `<mxGeometry relative="1" as="geometry" />` +
      `</mxCell>`
    );
  }

  const xml = `<mxfile host="TechFlow" modified="${new Date().toISOString()}" agent="TechFlow Exporter">
  <diagram name="Diagram" id="techflow-export">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return xml;
}
