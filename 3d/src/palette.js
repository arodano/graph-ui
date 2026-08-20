import { NODE_COLORS, TYPE_META } from "./config.js";
import { hex }                    from "./utils.js";
import { addNewNode }             from "./graph.js";

export function createPalette(scene, state) {
    const panel = document.getElementById("palette");

    Object.entries(TYPE_META).forEach(([type, meta]) => {
        const cHex = hex(NODE_COLORS[type]);
        const item = document.createElement("div");
        item.className  = "pal-item";
        item.draggable  = true;
        item.dataset.type = type;
        // Title-case the label for display
        const displayName = meta.label.charAt(0) + meta.label.slice(1).toLowerCase();
        item.innerHTML = `
            <span class="pal-badge" style="background:${cHex}28;color:${cHex};border:1px solid ${cHex}44">${meta.abbr}</span>
            <span class="pal-label">${displayName}</span>
        `;
        panel.appendChild(item);
        item.addEventListener("dragstart", e => e.dataTransfer.setData("nodeType", type));
    });

    const canvas = document.getElementById("renderCanvas");
    canvas.addEventListener("dragover", e => e.preventDefault());
    canvas.addEventListener("drop", e => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData("nodeType");
        if (!nodeType) return;

        const rect = canvas.getBoundingClientRect();
        const sx   = e.clientX - rect.left;
        const sy   = e.clientY - rect.top;

        const pick = scene.pick(sx, sy, m => m.name === "ground");
        const pos  = pick.hit
            ? new BABYLON.Vector3(pick.pickedPoint.x, 0.35, pick.pickedPoint.z)
            : new BABYLON.Vector3(0, 0.35, 0);

        addNewNode(scene, state, nodeType, pos);
    });
}
