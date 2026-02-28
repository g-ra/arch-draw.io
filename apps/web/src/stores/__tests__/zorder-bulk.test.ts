import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node } from "reactflow";

function makeNode(id: string, zIndex: number): Node {
  return { id, type: "techNode", position: { x: 0, y: 0 }, data: { label: id, category: "backend", zIndex } };
}

describe("bringSelectionToFront", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 5), makeNode("b", 15), makeNode("c", 25)],
      edges: [],
      selectedNodeIds: ["a", "b"],
    });
  });

  it("sets all selected nodes to maxZ + 1", () => {
    useDiagramStore.getState().bringSelectionToFront();
    const state = useDiagramStore.getState();
    const a = state.nodes.find((n) => n.id === "a")!;
    const b = state.nodes.find((n) => n.id === "b")!;
    expect(a.data.zIndex).toBe(26);
    expect(b.data.zIndex).toBe(26);
  });

  it("does not affect non-selected nodes", () => {
    useDiagramStore.getState().bringSelectionToFront();
    const c = useDiagramStore.getState().nodes.find((n) => n.id === "c")!;
    expect(c.data.zIndex).toBe(25);
  });

  it("uses max of UNSELECTED nodes, not all nodes", () => {
    // Selected nodes: a (5) and b (15). Unselected: c (25)
    // maxZ should be 25 (from c, unselected), so selected nodes go to 26
    // If bug was present, maxZ would be 25 anyway by accident since c is max
    // Let's pick a case where selected node holds the current max:
    useDiagramStore.setState({
      nodes: [makeNode("a", 30), makeNode("b", 5), makeNode("c", 10)],
      edges: [],
      selectedNodeIds: ["a"],
    });
    useDiagramStore.getState().bringSelectionToFront();
    const state = useDiagramStore.getState();
    // unselected max is max(5, 10) = 10, so a should go to 11
    expect(state.nodes.find((n) => n.id === "a")!.data.zIndex).toBe(11);
    // b and c untouched
    expect(state.nodes.find((n) => n.id === "b")!.data.zIndex).toBe(5);
    expect(state.nodes.find((n) => n.id === "c")!.data.zIndex).toBe(10);
  });
});

describe("sendSelectionToBack", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 5), makeNode("b", 15), makeNode("c", 25)],
      edges: [],
      selectedNodeIds: ["a", "b"],
    });
  });

  it("sets all selected nodes to 1", () => {
    useDiagramStore.getState().sendSelectionToBack();
    const state = useDiagramStore.getState();
    expect(state.nodes.find((n) => n.id === "a")!.data.zIndex).toBe(1);
    expect(state.nodes.find((n) => n.id === "b")!.data.zIndex).toBe(1);
  });

  it("does not affect non-selected nodes", () => {
    useDiagramStore.getState().sendSelectionToBack();
    expect(useDiagramStore.getState().nodes.find((n) => n.id === "c")!.data.zIndex).toBe(25);
  });
});
