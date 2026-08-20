import { NODE_COLORS, CARD_WIDTH, CARD_DEPTH, CARD_THICKNESS } from "./config.js";

// ── Active packet tracking (for cleanup on graph rebuild) ─────────────────────
const _active = new Set();

export function disposeAllPackets(scene) {
    _active.forEach(pkt => {
        if (pkt._cb) scene.unregisterBeforeRender(pkt._cb);
        pkt.mesh?.dispose();
    });
    _active.clear();
}

// ── Hook called before each packet fire/process; set from main.js ─────────────
let _beforeFireHook = null;
export function setBeforeFireHook(fn) { _beforeFireHook = fn; }

// ── Fake step data per node type (tariff calculation debug) ───────────────────
const _TEMPLATES = {
    NodeParameterInput:  n => ({ param: n.name,        value: '"POLYGON"',   type: 'string' }),
    NodeVariableInput:   n => ({ variable: n.name,     resolved: 12.80,      unit: 'ARS/kg' }),
    NodeConstantInput:   n => ({ constant: n.value ?? '1.0' }),
    NodeFieldSpec:       n => ({ field: n.name,        data_type: 'string',  nullable: false }),
    NodeFilter:          n => ({ expr: n.value,        input_rows: 1250,     output_rows: 142, ms: 14 }),
    NodeAggregate:       n => ({ group_by: n.value,    input_rows: 142,      groups: 18, total: 63.5 }),
    NodeGrouping:        n => ({ groups: 18,           total_weight: 63.5 }),
    NodeQuantitySpec:    n => ({ quantity: 3.5,        unit: 'kg' }),
    NodeConditional:     n => ({ condition: n.value,   true_count: 38,       false_count: 4, result: true }),
    NodeMathOperation:   n => ({ op: n.value,          a: 63.5,              b: 12.80, result: 812.80 }),
    NodeCompositeGroup:  n => ({ subgroups: 3,         combined: 812.80 }),
    NodeOutput:          n => ({ field: n.value ?? 'settlement', amount: 812.80, currency: 'ARS' }),
};

function _stepData(node) {
    return (_TEMPLATES[node.type] ?? (() => ({ value: '—' })))(node);
}

function _newData(node) {
    return {
        id:         `PKT-${Date.now().toString(36).toUpperCase()}`,
        originName: node.name,
        createdAt:  new Date().toISOString(),
        steps: [{
            nodeId:   node.id, nodeName: node.name, nodeType: node.type,
            data:     _stepData(node), at: new Date().toISOString(),
        }],
    };
}

function _addStep(data, node) {
    data.steps.push({
        nodeId: node.id, nodeName: node.name, nodeType: node.type,
        data: _stepData(node), at: new Date().toISOString(),
    });
}

// ── Packet mesh ───────────────────────────────────────────────────────────────
function _makeMesh(scene, node, pos) {
    const color  = NODE_COLORS[node.type];
    const sphere = BABYLON.MeshBuilder.CreateSphere(`_pkt_${Date.now()}`, {
        diameter: 0.36, segments: 8
    }, scene);
    sphere.position.copyFrom(pos);

    const mat = new BABYLON.StandardMaterial(`${sphere.name}_m`, scene);
    mat.diffuseColor  = color.scale(0.25);
    mat.emissiveColor = color.scale(1.1);
    mat.specularColor = BABYLON.Color3.White();
    mat.specularPower = 48;
    sphere.material   = mat;
    return sphere;
}

// ── Animation along a polyline ────────────────────────────────────────────────
const EDGE_SPEED  = 0.006;  // t/frame along edge curve (~2.8 s at 60 fps)
const CROSS_SPEED = 0.055;  // t/frame across card face  (~0.3 s)

function _travel(scene, mesh, pts, speed, onDone) {
    let t = 0;
    const n = pts.length - 1;
    const cb = () => {
        t = Math.min(1, t + speed);
        const fi = t * n;
        const i  = Math.floor(fi);
        mesh.position.copyFrom(BABYLON.Vector3.Lerp(pts[i], pts[Math.min(i + 1, n)], fi - i));
        if (t >= 1) { scene.unregisterBeforeRender(cb); onDone?.(); }
    };
    scene.registerBeforeRender(cb);
    return cb;
}

function _line(a, b, steps = 12) {
    const pts = [];
    for (let i = 0; i <= steps; i++) pts.push(BABYLON.Vector3.Lerp(a, b, i / steps));
    return pts;
}

function _detachPacketMesh(mesh) {
    if (!mesh?.parent) return;
    const abs = mesh.getAbsolutePosition().clone();
    mesh.parent = null;
    mesh.position.copyFrom(abs);
}

function _attachPacketToNodeInput(mesh, node) {
    if (!mesh || !node?.root || !node?.inputPort) return;
    mesh.parent = node.root;
    // Keep packet exactly on the input port so it follows node transforms.
    mesh.position.copyFrom(node.inputPort.position.clone());
}

function _clonePacketData(data) {
    if (typeof structuredClone === 'function') return structuredClone(data);
    return JSON.parse(JSON.stringify(data));
}

function _createPacketClone(scene, fromNode, startPos, sourceData) {
    const mesh = _makeMesh(scene, fromNode, startPos.clone());
    const packet = {
        mesh,
        data: _clonePacketData(sourceData),
        node: fromNode,
        _cb: null,
    };
    _active.add(packet);
    return packet;
}

function _sendPacketToEdge(scene, state, fromNode, packet, edge) {
    packet._cb = _travel(scene, packet.mesh, edge.curvePoints, EDGE_SPEED, () => {
        packet._cb = null;
        const dest = edge.to;
        _attachPacketToNodeInput(packet.mesh, dest);
        packet.mesh.metadata = { isPacket: true, packet };
        dest._packetAtInput = packet;
        refreshButton(fromNode, state);
        refreshButton(dest, state);
    });
}

function _fanOutPackets(scene, state, fromNode, basePacket, startPos, outEdges) {
    outEdges.forEach((edge, index) => {
        const packetForEdge = index === 0
            ? basePacket
            : _createPacketClone(scene, fromNode, startPos, basePacket.data);
        _sendPacketToEdge(scene, state, fromNode, packetForEdge, edge);
    });
}

function _toCssColor(color, alpha = 1) {
    const to255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    return `rgba(${to255(color.r)}, ${to255(color.g)}, ${to255(color.b)}, ${alpha})`;
}

// ── Button canvas drawing ─────────────────────────────────────────────────────
function _drawBtn(tex, mode, nodeColor) {
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 256, 128);

    const bg = _toCssColor(nodeColor, 0.18);
    const border = _toCssColor(nodeColor, 0.95);
    const fg = _toCssColor(nodeColor, 1);

    // Badge-like rectangular button, visually aligned with card labels.
    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    const x = 6;
    const y = 12;
    const w = 244;
    const h = 104;
    const r = 14;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Icon-only badge to match node type tag style.
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'play') {
        ctx.beginPath();
        ctx.moveTo(104, 34);
        ctx.lineTo(160, 64);
        ctx.lineTo(104, 94);
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.font = "700 60px 'Courier New', monospace";
        ctx.fillText('↺', 128, 68);
    }

    tex.update();
}

// ── Public: create button mesh parented to node.root ──────────────────────────
export function addPlayButton(scene, node) {
    const btn = BABYLON.MeshBuilder.CreatePlane(`${node.id}_btn`, {
        width: 0.56, height: 0.28
    }, scene);
    btn.parent    = node.root;
    // screen-top (world +Z) and screen-right (world +X) → header top-right
    btn.position.set(CARD_WIDTH / 2 - 0.56, CARD_THICKNESS + 0.07, CARD_DEPTH / 2 - 0.35);
    btn.rotation.x = Math.PI / 2;
    btn.isVisible  = false;
    btn.renderingGroupId = 1;

    const tex = new BABYLON.DynamicTexture(`${node.id}_btnTex`,
        { width: 256, height: 128 }, scene, false);
    tex.hasAlpha = true;

    const mat = new BABYLON.StandardMaterial(`${node.id}_btnMat`, scene);
    mat.diffuseTexture             = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor              = BABYLON.Color3.White();
    mat.specularColor              = BABYLON.Color3.Black();
    mat.backFaceCulling            = false;
    mat.disableLighting            = true;
    mat.zOffset                    = -2;
    btn.material = mat;
    btn._btnTex  = tex;
    btn.metadata = { isPlayButton: true, node };

    const gl = scene.effectLayers?.find(l => l.name === "glow");
    if (gl) gl.addExcludedMesh(btn);

    node._playBtn = btn;
    return btn;
}

// ── Recompute and redraw button for a node ─────────────────────────────────────
export function refreshButton(node, state) {
    const btn = node._playBtn;
    if (!btn) return;

    const hasInEdge  = state.edgeInstances.some(e => e.to === node);
    const hasPacketIn = !!node._packetAtInput;
    const hasSent     = !!node._packetSent;

    // play: no input edge OR packet waiting at input
    // repeat: already sent, nothing at input (overrides play for source nodes after first fire)
    let mode = 'none';
    if (!hasInEdge || hasPacketIn) mode = 'play';
    if (hasSent && !hasPacketIn)   mode = 'repeat';

    btn.isVisible = mode !== 'none';
    if (btn.isVisible) _drawBtn(btn._btnTex, mode, NODE_COLORS[node.type] || new BABYLON.Color3(0.30, 0.65, 0.95));
}

// ── Fire a new packet from a node's output port ───────────────────────────────
export async function firePacket(scene, node, state) {
    const outPos = node.outputPort.getAbsolutePosition().clone();
    const data   = _newData(node);
    const mesh   = _makeMesh(scene, node, outPos);
    const packet = { mesh, data, node, _cb: null };
    _active.add(packet);

    // Call debug API before animating so the result is available for the next node
    if (_beforeFireHook) {
        const result = await _beforeFireHook(node, state).catch(() => null);
        if (result) data.steps[data.steps.length - 1].apiResult = result;
    }

    node._lastPacket = packet;
    node._packetSent = true;

    const outEdges = state.edgeInstances.filter(e => e.from === node);
    if (outEdges.length) {
        _fanOutPackets(scene, state, node, packet, outPos, outEdges);
    } else {
        mesh.metadata = { isPacket: true, packet };
    }
    refreshButton(node, state);
}

// ── Process packet already sitting at input port, send it to output ───────────
export async function processPacket(scene, node, state) {
    const pkt = node._packetAtInput;
    if (!pkt) return;

    _addStep(pkt.data, node);

    // Call debug API before moving the packet
    if (_beforeFireHook) {
        const result = await _beforeFireHook(node, state).catch(() => null);
        if (result) pkt.data.steps[pkt.data.steps.length - 1].apiResult = result;
    }

    node._packetAtInput = null;
    node._packetSent    = true;
    _detachPacketMesh(pkt.mesh);
    pkt.mesh.metadata   = {};
    refreshButton(node, state);

    const inPos  = node.inputPort.getAbsolutePosition().clone();
    const outPos = node.outputPort.getAbsolutePosition().clone();

    pkt._cb = _travel(scene, pkt.mesh, _line(inPos, outPos), CROSS_SPEED, () => {
        pkt._cb = null;
        const outEdges = state.edgeInstances.filter(e => e.from === node);
        if (outEdges.length) {
            _fanOutPackets(scene, state, node, pkt, outPos, outEdges);
        } else {
            pkt.mesh.metadata = { isPacket: true, packet: pkt };
            refreshButton(node, state);
        }
    });
}

// ── Show packet debug panel ───────────────────────────────────────────────────
export function showPacketPanel(data) {
    const esc = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const pretty = (value) => {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    };

    const stripUiMeta = (apiResult) => {
        if (!apiResult || typeof apiResult !== 'object') return apiResult;
        const clean = { ...apiResult };
        delete clean._requestBody;
        delete clean._upstreamNodeMeta;
        return clean;
    };

    document.getElementById('pkt-title').textContent =
        `${data.id}  ·  origin: ${data.originName}  ·  ${data.steps.length} step(s)`;

    const tbody = document.getElementById('pkt-body');
    tbody.innerHTML = '';
    data.steps.forEach((s, i) => {
        const cells = Object.entries(s.data)
            .map(([k, v]) => `<span class="pk">${esc(k)}</span> <span class="pv">${esc(JSON.stringify(v))}</span>`)
            .join(' &nbsp; ');

        let apiRow = '';
        if (s.apiResult) {
            const requestBody = s.apiResult?._requestBody || {};
            const upstreamOutputs = requestBody?.upstreamOutputs || {};
            const upstreamMeta = s.apiResult?._upstreamNodeMeta || {};
            const inputEntries = Object.entries(upstreamOutputs);

            const inputRows = inputEntries.length
                ? inputEntries.map(([nodeId, nodeValueDto]) => {
                    const meta = upstreamMeta[nodeId] || {};
                    const nodeName = meta.nodeName || nodeId;
                    const nodeType = meta.nodeType || 'Unknown';
                    const nodeTime = meta.at ? new Date(meta.at).toLocaleTimeString() : '-';
                    return `
                        <tr>
                            <td>${esc(nodeName)}</td>
                            <td><code class="pt">${esc(String(nodeType).replace('Node', ''))}</code></td>
                            <td><code class="api-val">${esc(pretty(nodeValueDto))}</code></td>
                            <td class="pc">${esc(nodeTime)}</td>
                        </tr>
                    `;
                }).join('')
                : '<tr><td colspan="4" class="pd"><span class="api-lbl">No upstream inputs</span></td></tr>';

            const apiPayload = esc(pretty(stripUiMeta(s.apiResult)));

            apiRow = `
                <tr class="pkt-api">
                    <td></td>
                    <td colspan="4">
                        <details class="pkt-collapsible">
                            <summary><span class="api-lbl">INPUTS (outputs del nodo anterior)</span></summary>
                            <table class="pkt-mini-table">
                                <thead>
                                    <tr>
                                        <th>Node</th>
                                        <th>Type</th>
                                        <th>Data</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>${inputRows}</tbody>
                            </table>
                        </details>
                        <details class="pkt-collapsible">
                            <summary><span class="api-lbl">API</span></summary>
                            <code class="api-val">${apiPayload}</code>
                        </details>
                    </td>
                </tr>
            `;
        }

        tbody.insertAdjacentHTML('beforeend',
            `<tr>
                <td class="pc">${i + 1}</td>
                <td>${s.nodeName}</td>
                <td><code class="pt">${s.nodeType.replace('Node', '')}</code></td>
                <td class="pd">${cells}</td>
                <td class="pc">${new Date(s.at).toLocaleTimeString()}</td>
            </tr>${apiRow}`);
    });

    document.getElementById('pkt-panel').style.display = 'flex';
}
