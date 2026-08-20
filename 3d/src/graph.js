import { createGraphState, createEdge } from "./edges.js";
import { createNode }                   from "./nodes.js";
import { TYPE_META }                    from "./config.js";
import { refreshButton, disposeAllPackets } from "./packets.js";

export function buildGraph(scene, graphData) {
    const state = createGraphState();
    const { nodes, edges } = graphData;
    nodes.forEach(node => createNode(scene, node, state));
    edges.forEach(([fromId, toId], index) => {
        const from = state.nodesById[fromId];
        const to   = state.nodesById[toId];
        if (!from || !to) return;
        createEdge(scene, from, to, index, state);
    });
    // Show play buttons on source nodes (no incoming edges)
    nodes.forEach(n => refreshButton(state.nodesById[n.id], state));
    return state;
}

let _nodeCounter = 200;

export function addNewNode(scene, state, type, position) {
    const id   = `dyn_${_nodeCounter++}`;
    const meta = TYPE_META[type];
    const node = {
        id,
        type,
        name:        meta.label.charAt(0) + meta.label.slice(1).toLowerCase(),
        property:    "Type",
        value:       type,
        description: "",
        metadata:    { group: "", conceptos: "", adInfo: "" },
        position:    new BABYLON.Vector3(position.x, 0.35, position.z)
    };
    createNode(scene, node, state);
    return node;
}

export function addNewEdge(scene, state, fromNode, toNode) {
    const index = state.edgeInstances.length;
    createEdge(scene, fromNode, toNode, index, state);
    refreshButton(fromNode, state);
    refreshButton(toNode, state);
}

export function clearGraph(scene, state) {
    disposeAllPackets(scene);
    state.edgeInstances.forEach(edge => {
        if (edge._renderCallback) scene.unregisterBeforeRender(edge._renderCallback);
        edge.line?.dispose();
        edge.label?.dispose();
        edge.flowDots?.forEach(d => d.mesh?.dispose());
    });
    state.edgeInstances = [];
    Object.values(state.nodesById).forEach(node => {
        node.hitPlane?.dispose();
        node.root?.dispose(false, true); // disposes all parented children
        node._playBtn = null;
    });
    state.nodesById = {};
}

export function rebuildGraph(scene, state, graphData) {
    clearGraph(scene, state);
    const { nodes, edges } = graphData;
    nodes.forEach(node => createNode(scene, node, state));
    edges.forEach(([fromId, toId], index) => {
        const from = state.nodesById[fromId];
        const to   = state.nodesById[toId];
        if (from && to) createEdge(scene, from, to, index, state);
    });
    nodes.forEach(n => refreshButton(state.nodesById[n.id], state));
    return state;
}
