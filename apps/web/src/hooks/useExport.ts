import { useCallback } from "react";
import { toPng, toSvg } from "html-to-image";
import { Node, Edge } from "reactflow";
import { TechNodeData, FlowEdgeData } from "../types/diagram";
import { toMermaid } from "../lib/exportMermaid";
import { toDrawio } from "../lib/exportDrawio";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function safeName(name: string) {
  return name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
}

export function useExport(diagramName: string) {
  const exportPng = useCallback(async () => {
    const el = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!el) return;
    const dataUrl = await toPng(el, {
      backgroundColor: "#0f1117",
      pixelRatio: 2,
      filter: (node) => {
        const cls = (node as HTMLElement).classList;
        if (!cls) return true;
        if (cls.contains("react-flow__controls")) return false;
        if (cls.contains("react-flow__minimap")) return false;
        if (cls.contains("react-flow__panel")) return false;
        return true;
      },
    });
    const link = document.createElement("a");
    link.download = `${safeName(diagramName)}.png`;
    link.href = dataUrl;
    link.click();
  }, [diagramName]);

  const exportSvg = useCallback(async () => {
    const el = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!el) return;
    const dataUrl = await toSvg(el, {
      backgroundColor: "#0f1117",
      filter: (node) => {
        const cls = (node as HTMLElement).classList;
        if (!cls) return true;
        if (cls.contains("react-flow__controls")) return false;
        if (cls.contains("react-flow__minimap")) return false;
        if (cls.contains("react-flow__panel")) return false;
        return true;
      },
    });
    const link = document.createElement("a");
    link.download = `${safeName(diagramName)}.svg`;
    link.href = dataUrl;
    link.click();
  }, [diagramName]);

  const exportJson = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      download(
        `${safeName(diagramName)}.json`,
        JSON.stringify({ nodes, edges }, null, 2),
        "application/json"
      );
    },
    [diagramName]
  );

  const exportMermaid = useCallback(
    (nodes: Node<TechNodeData>[], edges: Edge<FlowEdgeData>[]) => {
      const code = toMermaid(nodes, edges);
      download(`${safeName(diagramName)}.md`, code, "text/markdown");
    },
    [diagramName]
  );

  const exportDrawio = useCallback(
    (nodes: Node<TechNodeData>[], edges: Edge<FlowEdgeData>[]) => {
      const xml = toDrawio(nodes, edges);
      download(`${safeName(diagramName)}.drawio`, xml, "application/xml");
    },
    [diagramName]
  );

  return { exportPng, exportSvg, exportJson, exportMermaid, exportDrawio };
}
