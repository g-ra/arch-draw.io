import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node, Edge } from "reactflow";

function makeNode(id: string, x = 0, y = 0): Node {
  return {
    id, type: "techNode",
    position: { x, y },
    width: 150, height: 60,
    data: { label: id, category: "backend" },
  };
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "animatedFlow", data: {} };
}

describe("autoLayout", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 0, 0), makeNode("b", 0, 0), makeNode("c", 0, 0)],
      edges: [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c")],
    });
  });

  it("repositions nodes so they are not all at (0,0)", () => {
    useDiagramStore.getState().autoLayout();
    const positions = useDiagramStore.getState().nodes.map((n) => n.position);
    const allSame = positions.every((p) => p.x === 0 && p.y === 0);
    expect(allSame).toBe(false);
  });

  it("preserves all node ids", () => {
    useDiagramStore.getState().autoLayout();
    const ids = useDiagramStore.getState().nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("marks diagram dirty", () => {
    useDiagramStore.setState({ isDirty: false });
    useDiagramStore.getState().autoLayout();
    expect(useDiagramStore.getState().isDirty).toBe(true);
  });
});
