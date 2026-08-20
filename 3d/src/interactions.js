import { NODE_COLORS, CARD_THICKNESS } from "./config.js";
import { deleteEdge, updateConnectedEdges } from "./edges.js";
import { firePacket, processPacket, showPacketPanel, refreshButton } from "./packets.js";

// ── Edge creation by dragging from output port ────────────────────────────────
export function setupEdgeCreation(scene, state, onEdgeCreated) {
    let drag          = null;
    let hoveredTarget = null;

    scene.onPointerObservable.add((info) => {
        const ev   = info.type;
        const mesh = info.pickInfo?.pickedMesh;

        // START: click on output port
        if (ev === BABYLON.PointerEventTypes.POINTERDOWN) {
            if (info.event.button !== 0) return;
            if (mesh?.metadata?.isPort && mesh.metadata.portType === "output") {
                scene.activeCamera.detachControl();
                const fromPos = mesh.metadata.node.outputPort.getAbsolutePosition().clone();
                const preview = BABYLON.MeshBuilder.CreateDashedLines("edgePreview", {
                    points:   [fromPos, fromPos.clone().add(new BABYLON.Vector3(0.01, 0, 0))],
                    dashSize: 0.18, gapSize: 0.12, dashNb: 20, updatable: true
                }, scene);
                preview.color = new BABYLON.Color3(0.3, 0.85, 1.0);
                drag = { fromNode: mesh.metadata.node, preview };
            }
        }

        // MOVE: update preview + highlight destination
        if (ev === BABYLON.PointerEventTypes.POINTERMOVE && drag) {
            const from   = drag.fromNode.outputPort.getAbsolutePosition().clone();
            const target = _nodeFromMesh(mesh, state);

            if (target && target !== drag.fromNode) {
                if (hoveredTarget !== target) {
                    if (hoveredTarget) _unhighlightNode(hoveredTarget);
                    _highlightNode(target);
                    hoveredTarget = target;
                }
                const to = target.inputPort.getAbsolutePosition().clone();
                from.y = to.y = CARD_THICKNESS + 0.12;
                BABYLON.MeshBuilder.CreateDashedLines(null, { points: [from, to], instance: drag.preview });
            } else {
                if (hoveredTarget) { _unhighlightNode(hoveredTarget); hoveredTarget = null; }
                const ray    = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), scene.activeCamera);
                const planeY = CARD_THICKNESS + 0.12;
                const tVal   = ray.direction.y !== 0 ? (planeY - ray.origin.y) / ray.direction.y : 1;
                const to     = ray.origin.add(ray.direction.scale(tVal));
                from.y = to.y = planeY;
                BABYLON.MeshBuilder.CreateDashedLines(null, { points: [from, to], instance: drag.preview });
            }
        }

        // END: release on any mesh belonging to a destination node
        if (ev === BABYLON.PointerEventTypes.POINTERUP && drag) {
            if (info.event.button !== 0) return;
            scene.activeCamera.attachControl(scene.getEngine().getRenderingCanvas(), true);
            if (hoveredTarget) { _unhighlightNode(hoveredTarget); hoveredTarget = null; }

            const targetNode = _nodeFromMesh(mesh, state);
            if (targetNode && targetNode !== drag.fromNode) {
                onEdgeCreated(drag.fromNode, targetNode);
            }
            drag.preview.dispose();
            drag = null;
        }
    });

    // Safety: cancel on mouseup outside canvas
    window.addEventListener("mouseup", (e) => {
        if (e.button !== 0 || !drag) return;
        scene.activeCamera.attachControl(scene.getEngine().getRenderingCanvas(), true);
        if (hoveredTarget) { _unhighlightNode(hoveredTarget); hoveredTarget = null; }
        drag.preview.dispose();
        drag = null;
    });
}

// ── Edge selection + Delete ───────────────────────────────────────────────────
export function setupEdgeSelection(scene, state) {
    let selected = null;

    scene.onPointerObservable.add((info) => {
        if (info.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
        if (info.event.button !== 0) return;
        const mesh = info.pickInfo?.pickedMesh;

        if (mesh?.metadata?.isEdgePick) {
            if (selected) _deselectEdge(selected);
            selected = mesh.metadata.edgeData;
            _selectEdge(selected);
        } else if (!mesh?.metadata?.isPort) {
            if (selected) { _deselectEdge(selected); selected = null; }
        }
    });

    window.addEventListener("keydown", (e) => {
        if ((e.key === "Delete" || e.key === "Backspace") && selected) {
            const { from, to } = selected;
            deleteEdge(selected, scene, state);
            selected = null;
            refreshButton(from, state);
            refreshButton(to, state);
        }
    });
}

// ── Node click-to-select + drag-to-move ───────────────────────────────────────────

export function setupNodeSelection(scene, state) {
    let selectedNode = null;
    let dragState    = null;

    scene.onPointerObservable.add((info) => {
        const ev   = info.type;
        const mesh = info.pickInfo?.pickedMesh;

        if (ev === BABYLON.PointerEventTypes.POINTERDOWN) {
            if (info.event.button !== 0) return;
            const node = _nodeFromMesh(mesh, state);
            // Let packet/button observers handle those clicks
            if (mesh?.metadata?.isPlayButton || mesh?.metadata?.isPacket) return;
            if (node && !mesh?.metadata?.isPort) {
                if (selectedNode && selectedNode !== node) _deselectNodeVisual(selectedNode);
                if (selectedNode !== node) { _selectNodeVisual(node); selectedNode = node; }
                scene.activeCamera.detachControl();
                dragState = { node, startX: scene.pointerX, startY: scene.pointerY, isDragging: false };
            } else if (!mesh?.metadata?.isPort && !mesh?.metadata?.isEdgePick) {
                if (selectedNode) { _deselectNodeVisual(selectedNode); selectedNode = null; }
            }
        }

        if (ev === BABYLON.PointerEventTypes.POINTERMOVE && dragState) {
            const dx = scene.pointerX - dragState.startX;
            const dy = scene.pointerY - dragState.startY;
            if (!dragState.isDragging && dx * dx + dy * dy > 64) dragState.isDragging = true;
            if (dragState.isDragging) {
                const pick = scene.pick(scene.pointerX, scene.pointerY, m => m.name === "ground");
                if (pick.hit) {
                    const n = dragState.node;
                    n.root.position.x     = pick.pickedPoint.x;
                    n.root.position.z     = pick.pickedPoint.z;
                    n.hitPlane.position.x = pick.pickedPoint.x;
                    n.hitPlane.position.z = pick.pickedPoint.z;
                    n.position.x          = pick.pickedPoint.x;
                    n.position.z          = pick.pickedPoint.z;
                    updateConnectedEdges(n, state);
                }
            }
        }

        if (ev === BABYLON.PointerEventTypes.POINTERUP && dragState) {
            if (info.event.button !== 0) return;
            scene.activeCamera.attachControl(scene.getEngine().getRenderingCanvas(), true);
            dragState = null;
        }
    });

    // Safety: re-attach camera if mouse released outside canvas
    window.addEventListener("mouseup", (e) => {
        if (e.button !== 0 || !dragState) return;
        scene.activeCamera.attachControl(scene.getEngine().getRenderingCanvas(), true);
        dragState = null;
    });
}

// ── Packet interaction: play/repeat buttons + packet click ───────────────────
export function setupPacketInteraction(scene, state) {
    scene.onPointerObservable.add((info) => {
        if (info.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
        if (info.event.button !== 0) return;
        const mesh = info.pickInfo?.pickedMesh;

        if (mesh?.metadata?.isPlayButton) {
            const node = mesh.metadata.node;
            if (node._packetAtInput) {
                processPacket(scene, node, state);
            } else {
                firePacket(scene, node, state);
            }
        }

        if (mesh?.metadata?.isPacket) {
            showPacketPanel(mesh.metadata.packet.data);
        }
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _nodeFromMesh(mesh, state) {
    if (!mesh) return null;
    const m = mesh.metadata;
    if (m?.isPort)     return m.node;
    if (m?.isNodeHit)  return m.node;
    // Flow dots and body meshes carry no metadata, but we can match by name prefix
    const id = Object.keys(state.nodesById).find(id =>
        mesh.name?.startsWith(id + "_") || mesh.name === id
    );
    return id ? state.nodesById[id] : null;
}

function _selectNodeVisual(node) {
    if (node.face?.material) node.face.material.emissiveColor = new BABYLON.Color3(0.55, 0.50, 0.38);
    if (node.root) node.root.scaling = new BABYLON.Vector3(1.035, 1.0, 1.035);
}

function _deselectNodeVisual(node) {
    if (node.face?.material) node.face.material.emissiveColor = new BABYLON.Color3(0.22, 0.22, 0.22);
    if (node.root) node.root.scaling = BABYLON.Vector3.One();
}

function _highlightNode(node) {
    if (node.face?.material) node.face.material.emissiveColor = new BABYLON.Color3(0.35, 0.65, 1.0);
}

function _unhighlightNode(node) {
    if (node.face?.material) node.face.material.emissiveColor = new BABYLON.Color3(0.22, 0.22, 0.22);
}

function _selectEdge(edgeData) {
    edgeData.line.color = new BABYLON.Color3(0.2, 0.9, 1.0);
    edgeData.flowDots?.forEach(d => { d.mesh.material.emissiveColor = new BABYLON.Color3(0.2, 0.9, 1.0); });
}

function _deselectEdge(edgeData) {
    edgeData.line.color = new BABYLON.Color3(0.22, 0.34, 0.50);
    const baseColor = NODE_COLORS[edgeData.from.type];
    edgeData.flowDots?.forEach(d => { d.mesh.material.emissiveColor = baseColor; });
}

