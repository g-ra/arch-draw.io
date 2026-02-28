import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node } from "reactflow";

function makeNode(id: string, zIndex?: number): Node {
  return {
    id,
    type: "techNode",
    position: { x: 0, y: 0 },
    data: { label: id, category: "backend", zIndex },
  };
}

describe("setNodeZIndex", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 10), makeNode("b", 20), makeNode("c")],
      edges: [],
    });
  });

  it("sets zIndex on a specific node", () => {
    useDiagramStore.getState().setNodeZIndex("a", 50);
    const node = useDiagramStore.getState().nodes.find((n) => n.id === "a");
    expect(node?.data.zIndex).toBe(50);
  });

  it("does not affect other nodes", () => {
    useDiagramStore.getState().setNodeZIndex("a", 50);
    const b = useDiagramStore.getState().nodes.find((n) => n.id === "b");
    expect(b?.data.zIndex).toBe(20);
  });

  it("marks diagram as dirty", () => {
    useDiagramStore.setState({ isDirty: false });
    useDiagramStore.getState().setNodeZIndex("a", 50);
    expect(useDiagramStore.getState().isDirty).toBe(true);
  });
});
