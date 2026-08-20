import { CARD_WIDTH, CARD_DEPTH, CARD_THICKNESS, NODE_COLORS } from "./config.js";
import { roundRect } from "./utils.js";

export function createGraphState() {
    return { nodesById: {}, edgeInstances: [] };
}

export function createEdge(scene, from, to, index, state) {
    const pts  = _bezierPoints(from, to);
    const line = BABYLON.MeshBuilder.CreateLines(`edge_${index}`, {
        points: pts, updatable: true
    }, scene);
    line.color                 = new BABYLON.Color3(0.22, 0.34, 0.50);
    line.intersectionThreshold = 0.15;

    const label    = _createEdgeLabel(scene, index);
    const flowDots = _createFlowDots(scene, index, NODE_COLORS[from.type]);
    const edgeData = { from, to, line, label, flowDots, curvePoints: pts };

    line.metadata = { isEdgePick: true, edgeData };

    const gl = scene.effectLayers?.find(l => l.name === "glow");
    if (gl) { gl.addExcludedMesh(line); if (label) gl.addExcludedMesh(label); }

    state.edgeInstances.push(edgeData);
    updateEdge(edgeData);

    const renderCallback = () => {
        const t = (performance.now() / 1400) % 1;
        edgeData.flowDots.forEach(dot => {
            const u = (t + dot.offset) % 1;
            dot.mesh.position.copyFrom(_posOnCurve(edgeData.curvePoints, u));
        });
    };
    scene.registerBeforeRender(renderCallback);
    edgeData._renderCallback = renderCallback;
}

export function updateEdge(edgeData) {
    edgeData.curvePoints = _bezierPoints(edgeData.from, edgeData.to);
    BABYLON.MeshBuilder.CreateLines(null, {
        points:   edgeData.curvePoints,
        instance: edgeData.line
    });

    if (edgeData.label) {
        const mid = _posOnCurve(edgeData.curvePoints, 0.5);
        mid.y += 0.12;
        edgeData.label.position.copyFrom(mid);
    }
}

export function updateConnectedEdges(node, state) {
    state.edgeInstances.forEach(edge => {
        if (edge.from === node || edge.to === node) updateEdge(edge);
    });
}

export function deleteEdge(edgeData, scene, state) {
    if (edgeData._renderCallback) scene.unregisterBeforeRender(edgeData._renderCallback);
    edgeData.line.dispose();
    edgeData.label?.dispose();
    edgeData.flowDots?.forEach(d => d.mesh.dispose());
    const idx = state.edgeInstances.indexOf(edgeData);
    if (idx >= 0) state.edgeInstances.splice(idx, 1);
}

// ── Bezier curve helpers ──────────────────────────────────────────────────────

const CURVE_STEPS = 40;

// Tangents extend horizontally from ports so the curve naturally avoids card bodies
function _bezierPoints(from, to) {
    const start = _getEdgePoint(from, to, "out");
    const end   = _getEdgePoint(to,   from, "in");
    const dist  = BABYLON.Vector3.Distance(start, end);
    const tang  = Math.max(CARD_WIDTH * 0.7, dist * 0.42);
    const c1    = new BABYLON.Vector3(start.x + tang, start.y, start.z);
    const c2    = new BABYLON.Vector3(end.x   - tang, end.y,   end.z);
    const pts   = [];
    for (let i = 0; i <= CURVE_STEPS; i++) {
        pts.push(_cubicBezier(start, c1, c2, end, i / CURVE_STEPS));
    }
    return pts;
}

function _cubicBezier(p0, p1, p2, p3, t) {
    const m = 1 - t;
    return p0.scale(m*m*m)
        .add(p1.scale(3*m*m*t))
        .add(p2.scale(3*m*t*t))
        .add(p3.scale(t*t*t));
}

function _posOnCurve(pts, t) {
    if (!pts?.length) return BABYLON.Vector3.Zero();
    const n  = pts.length - 1;
    const fi = Math.min(t * n, n - 0.0001);
    const i  = Math.floor(fi);
    return BABYLON.Vector3.Lerp(pts[i], pts[i + 1], fi - i);
}

// ── Side-point fallback (no port yet) ────────────────────────────────────────

function _getEdgePoint(node, other, side) {
    const port = side === "out" ? node.outputPort : node.inputPort;
    if (port) return port.getAbsolutePosition().clone();
    return _getSidePoint(node, other);
}

function _getSidePoint(from, to) {
    const dx   = to.position.x - from.position.x;
    const dz   = to.position.z - from.position.z;
    const absX = Math.abs(dx);
    const absZ = Math.abs(dz);
    let x = 0, z = 0;
    if (absX > absZ) {
        x = dx > 0 ? CARD_WIDTH / 2 : -CARD_WIDTH / 2;
        const f = dz / Math.max(absX, 0.001);
        z = Math.max(-CARD_DEPTH / 2, Math.min(CARD_DEPTH / 2, f * CARD_WIDTH / 2));
    } else {
        z = dz > 0 ? CARD_DEPTH / 2 : -CARD_DEPTH / 2;
        const f = dx / Math.max(absZ, 0.001);
        x = Math.max(-CARD_WIDTH / 2, Math.min(CARD_WIDTH / 2, f * CARD_DEPTH / 2));
    }
    return from.position.add(new BABYLON.Vector3(x, CARD_THICKNESS + 0.18, z));
}

function _createEdgeLabel(scene, index) {
    const plane = BABYLON.MeshBuilder.CreatePlane(`edgeLabel_${index}`, {
        width: 0.52, height: 0.34
    }, scene);
    plane.rotation.x = Math.PI / 2;

    const texture = new BABYLON.DynamicTexture(
        `edgeLabelTex_${index}`, { width: 128, height: 84 }, scene, false
    );
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 128, 84);
    ctx.fillStyle = "#0A0F1A";
    roundRect(ctx, 6, 6, 116, 72, 12);
    ctx.fill();
    ctx.strokeStyle = "#2A4060";
    ctx.lineWidth   = 2;
    roundRect(ctx, 6, 6, 116, 72, 12);
    ctx.stroke();
    ctx.fillStyle    = "#4A80B0";
    ctx.font         = "700 30px 'Courier New', monospace";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(index, 64, 44);
    texture.update();

    const mat = new BABYLON.StandardMaterial(`edgeLabelMat_${index}`, scene);
    mat.diffuseTexture  = texture;
    mat.emissiveColor   = new BABYLON.Color3(0.6, 0.6, 0.6);
    mat.specularColor   = BABYLON.Color3.Black();
    mat.backFaceCulling = false;
    plane.material      = mat;
    return plane;
}

function _createFlowDots(scene, index, color) {
    return [0, 0.36, 0.68].map((offset, i) => {
        const sphere = BABYLON.MeshBuilder.CreateSphere(`flowDot_${index}_${i}`, {
            diameter: 0.16, segments: 4
        }, scene);
        const mat = new BABYLON.StandardMaterial(`flowDotMat_${index}_${i}`, scene);
        mat.emissiveColor   = color;
        mat.disableLighting = true;
        sphere.material     = mat;
        return { mesh: sphere, offset };
    });
}

