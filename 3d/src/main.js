import { createBaseScene, createLights, createGrid, createGlowLayer, createGroundPlane } from "./scene.js";
import { createIsometricCamera, playIntroAnimation }                                       from "./camera.js";
import { createUI }                                                                        from "./ui.js";
import { buildGraph, addNewEdge, rebuildGraph }                                            from "./graph.js";
import { setupEdgeCreation, setupEdgeSelection, setupNodeSelection,
         setupPacketInteraction }                                                           from "./interactions.js";
import { createPalette }                                                                   from "./palette.js";
import { setBeforeFireHook }                                                               from "./packets.js";
import { createSidebar, callDebugNode, ctx as sidebarCtx, testDebugPanel, simulateRealDebugCall, clearDebugPanel, toggleDebugFooter } from "./sidebar.js";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const scene  = createBaseScene(engine);
const camera = createIsometricCamera(scene, canvas);
createLights(scene);
createGlowLayer(scene);
createGroundPlane(scene);
createGrid(scene);
createUI(scene);

const state = buildGraph(scene, { nodes: [], edges: [] });

setupEdgeCreation(scene, state, (from, to) => addNewEdge(scene, state, from, to));
setupEdgeSelection(scene, state);
setupNodeSelection(scene, state);
setupPacketInteraction(scene, state);
createPalette(scene, state);

// Wire debug-node API into the packet animation system
setBeforeFireHook((node, graphState) => callDebugNode(node, graphState));

// Sidebar: rebuilds the 3D graph when a formula is selected
createSidebar(scene, state, (graphData) => {
    rebuildGraph(scene, state, graphData);
    sidebarCtx.nodeOutputs = {};
    playIntroAnimation(camera, scene);
}, camera);

// Expose debug functions for testing in browser console
window.sidebar = { testDebugPanel, simulateRealDebugCall, clearDebugPanel, toggleDebugFooter };
window.testDebugPanel = testDebugPanel;
window.simulateRealDebugCall = simulateRealDebugCall;
window.clearDebugPanel = () => {
    const elem = document.getElementById('debug-panel');
    const empty = document.getElementById('debug-empty');
    if (elem && empty) {
        elem.innerHTML = '';
        elem.appendChild(empty);
        empty.style.display = 'block';
    }
};

window.toggleDebugFooter = () => {
    const footer = document.getElementById('debug-footer');
    const toggleBtn = document.getElementById('debug-toggle-btn');
    if (footer && toggleBtn) {
        footer.classList.toggle('collapsed');
        toggleBtn.textContent = footer.classList.contains('collapsed') ? '▲' : '▼';
    }
};

// Connect the debug toggle button to the handler
const debugToggleBtn = document.getElementById('debug-toggle-btn');
if (debugToggleBtn) {
    debugToggleBtn.addEventListener('click', window.toggleDebugFooter);
}

// Connect the clear button so debug output can be reset from UI
const debugClearBtn = document.getElementById('debug-clear-btn');
if (debugClearBtn) {
    debugClearBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        window.clearDebugPanel();
    });
}

// Collapsible side panels (left palette and right sidebar)
const palettePanel = document.getElementById('palette');
const sidebarPanel = document.getElementById('sidebar');
const paletteToggleBtn = document.getElementById('palette-toggle-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

function resizeViewportDuringTransition() {
    // Keep Babylon viewport in sync while CSS width transition is running.
    const durationMs = 260;
    const stepMs = 32;
    const start = performance.now();

    function tick(now) {
        engine.resize();
        if (camera._updateOrtho) camera._updateOrtho();
        if (now - start < durationMs) {
            requestAnimationFrame(tick);
        }
    }

    requestAnimationFrame(tick);
    setTimeout(() => {
        engine.resize();
        if (camera._updateOrtho) camera._updateOrtho();
    }, stepMs);
    setTimeout(() => {
        engine.resize();
        if (camera._updateOrtho) camera._updateOrtho();
    }, durationMs + 20);
}

function refreshSidePanelToggleIcons() {
    if (palettePanel && paletteToggleBtn) {
        paletteToggleBtn.textContent = palettePanel.classList.contains('collapsed') ? '▶' : '◀';
    }
    if (sidebarPanel && sidebarToggleBtn) {
        sidebarToggleBtn.textContent = sidebarPanel.classList.contains('collapsed') ? '◀' : '▶';
    }
}

if (palettePanel && paletteToggleBtn) {
    paletteToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        palettePanel.classList.toggle('collapsed');
        refreshSidePanelToggleIcons();
        resizeViewportDuringTransition();
    });
}

if (sidebarPanel && sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        sidebarPanel.classList.toggle('collapsed');
        refreshSidePanelToggleIcons();
        resizeViewportDuringTransition();
    });
}

refreshSidePanelToggleIcons();

if (Object.keys(state.nodesById || {}).length > 0) {
    playIntroAnimation(camera, scene);
}

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

