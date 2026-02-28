import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node, Edge } from "reactflow";

function makeNode(id: string): Node {
  return { id, type: "techNode", position: { x: 10, y: 20 }, data: { label: id, category: "backend" } };
}
function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "animatedFlow", data: {} };
}

describe("saveMacro", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a"), makeNode("b"), makeNode("c")],
      edges: [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c"), makeEdge("e3", "a", "c")],
      macros: [],
      selectedNodeIds: ["a", "b"],
    });
  });

  it("saves a macro with selected nodes only", () => {
    useDiagramStore.getState().saveMacro("My Pattern", ["auth"]);
    const macros = useDiagramStore.getState().macros;
    expect(macros).toHaveLength(1);
    expect(macros[0].name).toBe("My Pattern");
    expect(macros[0].tags).toEqual(["auth"]);
    expect(macros[0].nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("only includes edges where both endpoints are in selection", () => {
    useDiagramStore.getState().saveMacro("My Pattern", []);
    const macro = useDiagramStore.getState().macros[0];
    // e1 (a→b) is fully internal; e2 (b→c) and e3 (a→c) cross boundary
    expect(macro.edges.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("deleteMacro", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [], edges: [],
      macros: [{ id: "m1", name: "Test", tags: [], nodes: [], edges: [], createdAt: "" }],
    });
  });

  it("removes macro by id", () => {
    useDiagramStore.getState().deleteMacro("m1");
    expect(useDiagramStore.getState().macros).toHaveLength(0);
  });
});

describe("insertMacro", () => {
  beforeEach(() => {
    useDiagramStore.setState({ nodes: [], edges: [], macros: [] });
  });

  it("adds cloned nodes at target position (top-left of bounding box)", () => {
    const macro = {
      id: "m1", name: "Test", tags: [], createdAt: "",
      nodes: [makeNode("orig-a")],
      edges: [],
    };
    useDiagramStore.getState().insertMacro(macro, { x: 100, y: 200 });
    const nodes = useDiagramStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).not.toBe("orig-a");
    expect(nodes[0].position.x).toBe(100);
    expect(nodes[0].position.y).toBe(200);
  });

  it("remaps edge source/target to new node ids", () => {
    const macro = {
      id: "m1", name: "Test", tags: [], createdAt: "",
      nodes: [makeNode("orig-a"), makeNode("orig-b")],
      edges: [makeEdge("orig-e1", "orig-a", "orig-b")],
    };
    useDiagramStore.getState().insertMacro(macro, { x: 0, y: 0 });
    const { nodes, edges } = useDiagramStore.getState();
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(nodes[0].id);
    expect(edges[0].target).toBe(nodes[1].id);
  });

  it("marks diagram dirty", () => {
    useDiagramStore.setState({ isDirty: false });
    useDiagramStore.getState().insertMacro({ id: "m1", name: "T", tags: [], createdAt: "", nodes: [], edges: [] }, { x: 0, y: 0 });
    expect(useDiagramStore.getState().isDirty).toBe(true);
  });
});
