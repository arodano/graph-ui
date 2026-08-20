import { resetCamera } from "./camera.js";

// Shared context — imported by main.js to wire up the packet hook
export const ctx = {
    formulaId:   null,
    formulaName: null,
    parameters: [
        { parameterName: 'ContainerTypeName', value: '507865e7-4d7b-4071-b53e-540d6e3259d5' },
        { parameterName: 'ConceptPrice',      value: '50.00' },
    ],
    masterData: {
        branchSystemId: 'd3f877ce-a29c-4aaa-94e8-ccd422576074',
        supplierIdSap:  '153895',
        distributorDNI: '20837197',
        vehicleDomain:  'AH521YX',
        startDate:      '20260701',
        endDate:        '20260702',
    },
    payableItems: [],
    nodeOutputs:  {},   // nodeId → last debug-node response
    apiBase:      'http://localhost:3002/api/v1/FormulaGraph',
    proxyBase:    'http://localhost:3002',
};

// ── Debug Functions ──────────────────────────────────────────────────────────

// Función para mostrar respuesta de debug en el panel
function showDebugResponse(node, result, upstreamOutputs) {
    const debugPanel = document.getElementById('debug-panel');
    const debugEmpty = document.getElementById('debug-empty');
    
    if (!debugPanel) {
        console.error('Debug panel not found!');
        return;
    }
    
    // Ocultar mensaje de vacío si existe
    if (debugEmpty) debugEmpty.style.display = 'none';
    
    // Crear entrada de debug
    const debugEntry = document.createElement('div');
    debugEntry.className = 'debug-entry';
    debugEntry.dataset.nodeId = node.id;
    debugEntry.dataset.timestamp = new Date().toISOString();
    
    const timestamp = new Date().toLocaleTimeString();
    const nodeType = node.type || 'Node';
    const nodeName = node.name || node.id;
    
    // Determinar si es error o éxito
    const hasError = result._error !== undefined;
    const statusClass = hasError ? 'error' : 'success';
    const statusText = hasError ? 'ERROR' : 'SUCCESS';
    const statusIcon = hasError ? '⚠️' : '✅';
    const inputsCount = upstreamOutputs ? Object.keys(upstreamOutputs).length : 0;
    
    debugEntry.classList.add(statusClass);
    
    debugEntry.innerHTML = `
        <div class="debug-entry-header">
            <div class="debug-entry-title">${statusIcon} ${nodeType}: ${nodeName}</div>
            <div class="debug-entry-timestamp">${timestamp}</div>
        </div>
        <div class="debug-entry-meta">
            <div class="debug-entry-inputs">Inputs used: ${inputsCount}</div>
            <div class="debug-entry-status ${statusClass}">${statusText}</div>
        </div>
        <div class="debug-entry-content">
            <pre class="debug-entry-data"></pre>
        </div>
    `;
    
    // Insertar al inicio del panel
    if (debugPanel.firstChild && debugPanel.firstChild.id !== 'debug-empty') {
        debugPanel.insertBefore(debugEntry, debugPanel.firstChild);
    } else {
        debugPanel.appendChild(debugEntry);
    }
    
    // Limitar a 15 entradas máximo
    const entries = debugPanel.querySelectorAll('.debug-entry');
    if (entries.length > 15) {
        for (let i = 15; i < entries.length; i++) {
            entries[i].remove();
        }
    }
    
    // Mostrar datos en el panel
    const debugData = debugEntry.querySelector('.debug-entry-data');
    try {
        const displayResult = hasError ? result : { success: true, ...result };
        debugData.textContent = JSON.stringify(displayResult, null, 2).substring(0, 3000);
    } catch (e) {
        debugData.textContent = String(result);
    }
    
    // Hacer el header clickeable para expandir/contraer
    const header = debugEntry.querySelector('.debug-entry-header');
    const content = debugEntry.querySelector('.debug-entry-content');
    
    header.addEventListener('click', () => {
        content.classList.toggle('expanded');
    });
    
    // Auto-expandir si es un error
    if (hasError) {
        content.classList.add('expanded');
    }
    
    return debugEntry; // Return the element for later updates
}

// Función para crear una entrada de debug en estado "cargando"
function createDebugLoadingEntry(node, upstreamOutputs) {
    const debugPanel = document.getElementById('debug-panel');
    const debugEmpty = document.getElementById('debug-empty');
    
    if (!debugPanel) {
        console.error('Debug panel not found!');
        return null;
    }
    
    // Ocultar mensaje de vacío si existe
    if (debugEmpty) debugEmpty.style.display = 'none';
    
    // Crear entrada de debug en estado "cargando"
    const debugEntry = document.createElement('div');
    debugEntry.className = 'debug-entry loading';
    debugEntry.dataset.nodeId = node.id;
    debugEntry.dataset.timestamp = new Date().toISOString();
    debugEntry.dataset.entryId = `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const timestamp = new Date().toLocaleTimeString();
    const nodeType = node.type || 'Node';
    const nodeName = node.name || node.id;
    const inputsCount = upstreamOutputs ? Object.keys(upstreamOutputs).length : 0;
    
    // Store node info in dataset for later updates
    debugEntry.dataset.nodeType = nodeType;
    debugEntry.dataset.nodeName = nodeName;
    
    debugEntry.innerHTML = `
        <div class="debug-entry-header">
            <div class="debug-entry-title">⏳ ${nodeType}: ${nodeName}</div>
            <div class="debug-entry-timestamp">${timestamp}</div>
        </div>
        <div class="debug-entry-meta">
            <div class="debug-entry-inputs">Inputs used: ${inputsCount}</div>
            <div class="debug-entry-status loading">LOADING...</div>
        </div>
        <div class="debug-entry-content loading">
            <div class="debug-loading-text">Processing debug request for node "${nodeName}"...</div>
            <pre class="debug-entry-data" style="display: none;"></pre>
        </div>
    `;
    
    // Insertar al inicio del panel
    if (debugPanel.firstChild && debugPanel.firstChild.id !== 'debug-empty') {
        debugPanel.insertBefore(debugEntry, debugPanel.firstChild);
    } else {
        debugPanel.appendChild(debugEntry);
    }
    
    // Limitar a 15 entradas máximo
    const entries = debugPanel.querySelectorAll('.debug-entry');
    if (entries.length > 15) {
        for (let i = 15; i < entries.length; i++) {
            entries[i].remove();
        }
    }
    
    // Hacer el header clickeable para expandir/contraer
    const header = debugEntry.querySelector('.debug-entry-header');
    const content = debugEntry.querySelector('.debug-entry-content');
    
    header.addEventListener('click', () => {
        content.classList.toggle('expanded');
    });
    
    // Hacer que el contenido de loading esté expandido inicialmente
    content.classList.add('expanded');
    
    return debugEntry.dataset.entryId; // Return the ID for later updates
}

// Función para actualizar una entrada de debug existente
function updateDebugEntry(entryId, result, upstreamOutputs) {
    const debugEntry = document.querySelector(`[data-entry-id="${entryId}"]`);
    if (!debugEntry) {
        console.warn(`Debug entry not found: ${entryId}`);
        return;
    }
    
    // Determinar si es error o éxito
    const hasError = result._error !== undefined;
    const statusClass = hasError ? 'error' : 'success';
    const statusText = hasError ? 'ERROR' : 'SUCCESS';
    const statusIcon = hasError ? '⚠️' : '✅';
    const inputsCount = upstreamOutputs ? Object.keys(upstreamOutputs).length : 0;
    
    // Actualizar clases
    debugEntry.classList.remove('loading');
    debugEntry.classList.add(statusClass);
    
    // Actualizar contenido
    const header = debugEntry.querySelector('.debug-entry-header');
    const title = debugEntry.querySelector('.debug-entry-title');
    const statusEl = debugEntry.querySelector('.debug-entry-status');
    const inputsEl = debugEntry.querySelector('.debug-entry-inputs');
    const loadingText = debugEntry.querySelector('.debug-loading-text');
    const dataEl = debugEntry.querySelector('.debug-entry-data');
    const content = debugEntry.querySelector('.debug-entry-content');
    
    if (title) title.textContent = `${statusIcon} ${debugEntry.dataset.nodeType || 'Node'}: ${debugEntry.dataset.nodeName || 'Unknown'}`;
    if (statusEl) {
        statusEl.textContent = statusText;
        statusEl.className = `debug-entry-status ${statusClass}`;
    }
    if (inputsEl) inputsEl.textContent = `Inputs used: ${inputsCount}`;
    
    // Ocultar texto de loading y mostrar datos
    if (loadingText) loadingText.style.display = 'none';
    if (dataEl) {
        dataEl.style.display = 'block';
        try {
            const displayResult = hasError ? result : { success: true, ...result };
            dataEl.textContent = JSON.stringify(displayResult, null, 2).substring(0, 3000);
        } catch (e) {
            dataEl.textContent = String(result);
        }
    }
    
    // Auto-expandir si es un error
    if (hasError) {
        content.classList.add('expanded');
    }
    
    // Restaurar funcionalidad de click después de actualizar
    content.classList.remove('loading');
}

// Función para limpiar el panel de debug (footer)
function clearDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    const debugEmpty = document.getElementById('debug-empty');
    
    if (debugPanel) {
        debugPanel.innerHTML = '';
        if (debugEmpty) {
            debugPanel.appendChild(debugEmpty);
            debugEmpty.style.display = 'block';
        }
    }
}

// Función para expandir/colapsar el footer
function toggleDebugFooter() {
    const footer = document.getElementById('debug-footer');
    const toggleBtn = document.getElementById('debug-toggle-btn');
    
    if (footer && toggleBtn) {
        footer.classList.toggle('collapsed');
        toggleBtn.textContent = footer.classList.contains('collapsed') ? '▲' : '▼';
    }
}

// ── Debug-node API call (called by packet hook in main.js) ────────────────────
export async function callDebugNode(node, state) {
    if (!ctx.formulaId) return null;

    // Collect outputs from all upstream nodes in the graph
    const upMap = {};
    state.edgeInstances.filter(e => e.to === node)
        .forEach(e => { if (ctx.nodeOutputs[e.from.id] != null) upMap[e.from.id] = ctx.nodeOutputs[e.from.id]; });

    const upstreamOutputs = Object.keys(upMap).length
        ? upMap
        : (ctx.payableItems && ctx.payableItems.length ? ctx.payableItems : {});
    
    // Asegurar que upstreamOutputs sea un objeto, nunca null
    const safeUpstreamOutputs = upstreamOutputs || {};
    
    // Create loading entry immediately
    const entryId = createDebugLoadingEntry(node, safeUpstreamOutputs);
    if (!entryId) return null;

    // Declare timeoutId outside try block so it's available in catch
    let timeoutId;
    
    try {
        // Configurar timeout de 30 segundos
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const requestBody = {
            formulaId: ctx.formulaId,
            nodeId: node.id,
            parameters: ctx.parameters,
            upstreamOutputs: safeUpstreamOutputs,
        };
        
        console.log('[debug-node] Sending request:', {
            formulaId: ctx.formulaId,
            nodeId: node.id,
            parametersCount: ctx.parameters?.length,
            upstreamOutputsCount: Object.keys(safeUpstreamOutputs).length,
            requestBody
        });
        
        const resp = await fetch(`http://localhost:3002/api/v1/FormulaGraph/debug-node`, {
            method:  'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const responseText = await resp.text();
        console.log(`[debug-node] Response status: ${resp.status}, length: ${responseText.length}`);
        
        if (!resp.ok) {
            console.error(`Error in debug-node for ${node.name}:`, resp.status, responseText.substring(0, 500));
            throw new Error(`HTTP ${resp.status}: ${responseText.substring(0, 100)}`);
        }
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.warn(`[debug-node] Non-JSON response from debug-node API:`, responseText.substring(0, 500));
            result = { _error: `Invalid JSON response: ${responseText.substring(0, 100)}` };
        }
        
        ctx.nodeOutputs[node.id] = result;
        
        // Update the debug entry with the result
        updateDebugEntry(entryId, result, safeUpstreamOutputs);
        
        return result;
    } catch (err) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        console.warn(`[debug-node] ${node.name}:`, err.message);
        
        let errorResult = { _error: err.message };
        
        if (err.name === 'AbortError') {
            console.warn(`[debug-node] ${node.name}: Timeout - API not responding`);
            errorResult = { _error: 'Timeout: La API tardó demasiado en responder. Verifica que esté corriendo en localhost:5001' };
        } else if (err.message.includes('ECONNREFUSED') || err.message.includes('Failed to fetch')) {
            console.warn(`[debug-node] ${node.name}: Connection refused - API not available`);
            errorResult = { _error: 'Conexión rechazada: La API no está disponible en localhost:5001' };
        }
        
        // Update the debug entry with the error
        updateDebugEntry(entryId, errorResult, safeUpstreamOutputs);
        
        return errorResult;
    }
}

// Test function to simulate debug responses for demonstration
function testDebugPanel() {
    const testNodes = [
        { id: 'test-node-1', name: 'Test Node 1', type: 'NodeVariableInput' },
        { id: 'test-node-2', name: 'Test Node 2', type: 'NodeParameterInput' },
        { id: 'test-node-3', name: 'Test Node 3', type: 'NodeOutput' },
        { id: 'test-node-4', name: 'Multi Step Calculation', type: 'NodeMathOp' },
        { id: 'test-node-5', name: 'Filter Operation', type: 'NodeFilter' }
    ];
    
    const testResults = [
        { 
            result: 42, 
            intermediateValue: 'Calculation complete',
            timestamp: new Date().toISOString(),
            metadata: { operation: 'addition', values: [20, 22] }
        },
        { 
            _error: 'Timeout: La API tardó demasiado en responder. Verifica que esté corriendo en localhost:5001',
            details: 'Connection timeout after 30 seconds'
        },
        { 
            data: [1, 2, 3, 4, 5], 
            status: 'success', 
            computedValue: 15,
            summary: 'Total items processed: 5'
        },
        {
            operation: 'multiplication',
            operands: [7, 6],
            result: 42,
            steps: [
                { step: 1, operation: 'fetch_input', value: 7 },
                { step: 2, operation: 'fetch_input', value: 6 },
                { step: 3, operation: 'multiply', result: 42 }
            ]
        },
        {
            filter: { field: 'status', value: 'active' },
            inputData: { items: 100, entries: [{id: 1, status: 'active'}, {id: 2, status: 'inactive'}] },
            outputData: { filteredItems: [{id: 1, status: 'active'}] },
            count: 1
        }
    ];
    
    const testInputs = [
        { param1: 'value1', param2: 'value2' },
        { upstreamNode1: 'calculated_value_1' },
        { sourceData: 'dataset_2024', items: 5 },
        { operand1: 7, operand2: 6, operation: 'multiply' },
        { dataset: 'user_records', filters: ['active'] }
    ];
    
    // Function to simulate delayed response with loading state
    const simulateDebugNodeCall = async (node, result, inputs, delay) => {
        // Create loading entry immediately
        const entryId = createDebugLoadingEntry(node, inputs);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Update with result
        updateDebugEntry(entryId, result, inputs);
    };
    
    // Simulate debug calls with loading states
    testNodes.forEach((node, index) => {
        setTimeout(() => {
            simulateDebugNodeCall(node, testResults[index], testInputs[index], 1500);
        }, index * 2500); // Stagger the calls
    });
    
    return 'Test debug responses queued (5 loading states will appear and update after delay)';
}

// Simulate a real debug-node API call with loading state
async function simulateRealDebugCall(nodeId, nodeName, nodeType, delayMS = 2000) {
    const node = { id: nodeId, name: nodeName, type: nodeType };
    const inputs = { someParam: 'test value', anotherParam: 123 };
    
    // Create loading entry
    const entryId = createDebugLoadingEntry(node, inputs);
    
    try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, delayMS));
        
        // Randomly simulate success or error
        const isSuccess = Math.random() > 0.3;
        if (isSuccess) {
            const result = {
                success: true,
                data: `Result from ${nodeName}`,
                timestamp: new Date().toISOString(),
                computedValue: Math.random() * 1000,
                metadata: { operation: 'calculation', nodeType: nodeType }
            };
            updateDebugEntry(entryId, result, inputs);
            return result;
        } else {
            const errorResult = {
                _error: `Simulated error in ${nodeName}: Timeout or validation failed`,
                details: `Failed after ${delayMS}ms delay`,
                code: 'SIM_ERROR'
            };
            updateDebugEntry(entryId, errorResult, inputs);
            return errorResult;
        }
    } catch (err) {
        const errorResult = { _error: `Exception: ${err.message}` };
        updateDebugEntry(entryId, errorResult, inputs);
        return errorResult;
    }
}

// Exponer las funciones de prueba para depuración
window.testDebugPanel = testDebugPanel;
window.simulateRealDebugCall = simulateRealDebugCall;

// Exportar funciones para main.js
export {
    showDebugResponse,
    clearDebugPanel,
    toggleDebugFooter,
    testDebugPanel,
    simulateRealDebugCall
};

// Create sidebar UI for loading formulas, items, and parameters
export function createSidebar(scene, state, onFormulaSelect, camera) {
    console.log('createSidebar called with:', { scene, state, camera });
    
    // Use existing sidebar element from HTML
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        console.error('Sidebar element not found in HTML!');
        return;
    }
    
    // Connect existing HTML buttons to handler functions
    const itemsBtn = document.getElementById('sb-items-btn');
    const formulasBtn = document.getElementById('sb-formulas-btn');
    const paramsBtn = document.getElementById('sb-params-btn');
    const execBtn = document.getElementById('sb-exec-btn');
    
    if (itemsBtn) itemsBtn.onclick = () => loadItems();
    if (formulasBtn) formulasBtn.onclick = () => loadFormulas();
    if (paramsBtn) paramsBtn.onclick = () => editParameters();
    if (execBtn) execBtn.onclick = () => executeFormula();
    
    // Helper functions
    function loadItems() {
        console.log('Loading items...');
        const content = document.getElementById('sb-items-wrap');
        if (content) {
            content.innerHTML = '<div class="sb-hint">Loading items...</div>';

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('API timeout')), 45000)
            );

            const q = new URLSearchParams({
                BranchSystemId: ctx.masterData.branchSystemId,
                SupplierIdSap: ctx.masterData.supplierIdSap,
                DistributorDNI: ctx.masterData.distributorDNI,
                VehicleDomain: ctx.masterData.vehicleDomain,
                StartDate: ctx.masterData.startDate,
                EndDate: ctx.masterData.endDate
            });

            Promise.race([
                fetch(`${ctx.proxyBase}/api/v1/FormulaGraph/master-data?${q.toString()}`).then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                }),
                timeoutPromise
            ])
                .then(payload => {
                    const items = Array.isArray(payload?.payableItems)
                        ? payload.payableItems
                        : (Array.isArray(payload) ? payload : []);

                    ctx.payableItems = items;

                    if (!items.length) {
                        content.innerHTML = '<div class="sb-hint">No items found for default filters.</div>';
                        return;
                    }

                    const cols = ['id', 'concept', 'type', 'itemDate', 'vehicleDomain', 'supplierIdSAP', 'weightValue', 'kilometerValue'];
                    const thead = cols.map(c => `<th>${c}</th>`).join('');
                    const rows = items.slice(0, 200).map(item => {
                        const tds = cols.map(c => {
                            const value = item?.[c] ?? '';
                            return `<td>${String(value)}</td>`;
                        }).join('');
                        return `<tr>${tds}</tr>`;
                    }).join('');

                    content.innerHTML = `
                        <div class="sb-count">${items.length} items loaded (default filters)</div>
                        <div class="sb-tbl-scroll">
                            <table class="sb-tbl">
                                <thead><tr>${thead}</tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    `;
                })
                .catch(error => {
                    console.error('Error loading items:', error);
                    content.innerHTML = `<div class="sb-err">Error loading items: ${error.message}</div>`;
                });
        }
    }

    function mapNodeKindToType(kind) {
        const map = {
            Aggregate: 'NodeAggregate',
            CompositeGroup: 'NodeCompositeGroup',
            Conditional: 'NodeConditional',
            ConstantInput: 'NodeConstantInput',
            FieldSpec: 'NodeFieldSpec',
            Filter: 'NodeFilter',
            Grouping: 'NodeGrouping',
            MathOperation: 'NodeMathOperation',
            Output: 'NodeOutput',
            ParameterInput: 'NodeParameterInput',
            QuantitySpec: 'NodeQuantitySpec',
            VariableInput: 'NodeVariableInput'
        };
        return map[kind] || 'NodeVariableInput';
    }

    function tryParseNodeData(nodeData) {
        if (!nodeData) return {};
        if (typeof nodeData === 'object') return nodeData;
        if (typeof nodeData !== 'string') return {};
        try {
            return JSON.parse(nodeData);
        } catch {
            return {};
        }
    }

    function buildGraphDataFromFormula(formula) {
        const rawNodes = Array.isArray(formula?.Nodes) ? formula.Nodes : [];
        const rawEdges = Array.isArray(formula?.Edges) ? formula.Edges : [];

        const cols = Math.max(1, Math.ceil(Math.sqrt(rawNodes.length || 1)));
        const spacingX = 9;
        const spacingZ = 6;

        const nodes = rawNodes.map((n, index) => {
            const data = tryParseNodeData(n.NodeData);
            const type = mapNodeKindToType(n.NodeKind);
            const keyNames = Object.keys(data);
            const firstKey = keyNames[0] || 'Data';

            return {
                id: n.Id,
                type,
                name: n.Label || type,
                property: firstKey,
                value: keyNames.length ? String(data[firstKey]) : '',
                description: '',
                metadata: {
                    group: n.NodeKind || '',
                    conceptos: '',
                    adInfo: keyNames.join(', ')
                },
                position: new BABYLON.Vector3(
                    -((cols - 1) * spacingX) / 2 + (index % cols) * spacingX,
                    0.35,
                    -Math.floor(index / cols) * spacingZ
                )
            };
        });

        const edges = rawEdges
            .filter(e => e.FromNodeId && e.ToNodeId)
            .map(e => [e.FromNodeId, e.ToNodeId]);

        return { nodes, edges };
    }
    
    function loadFormulas() {
        console.log('Loading formulas...');
        const content = document.getElementById('sb-formula-list');
        const selectedFormulaLabel = document.getElementById('sb-sel-formula');
        if (content) {
            content.textContent = 'Loading formulas...';

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('API timeout')), 10000)
            );

            Promise.race([
                fetch(`${ctx.proxyBase}/api/formulas`).then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                }),
                timeoutPromise
            ])
                .then(payload => {
                    const formulas = Array.isArray(payload?.Formulas)
                        ? payload.Formulas
                        : (Array.isArray(payload) ? payload : []);

                    content.innerHTML = '';
                    if (!formulas.length) {
                        content.textContent = 'No formulas available';
                        return;
                    }

                    const escapeHtml = (value) => String(value ?? '')
                        .replaceAll('&', '&amp;')
                        .replaceAll('<', '&lt;')
                        .replaceAll('>', '&gt;')
                        .replaceAll('"', '&quot;')
                        .replaceAll("'", '&#39;');

                    const tableData = formulas.map((formula, index) => {
                        const formulaId = formula.FormulaId || formula.id || `formula-${index + 1}`;
                        const formulaName = formula.Name || formula.FormulaName || formula.Title || formula.name || `Formula ${index + 1}`;
                        const nodeCount = Array.isArray(formula.Nodes) ? formula.Nodes.length : 0;
                        const edgeCount = Array.isArray(formula.Edges) ? formula.Edges.length : 0;
                        const paramCount = Array.isArray(formula.ParameterDefinitions) ? formula.ParameterDefinitions.length : 0;
                        const metaCount = Array.isArray(formula.MetaNodes) ? formula.MetaNodes.length : 0;
                        return {
                            formula,
                            formulaId,
                            formulaName,
                            nodeCount,
                            edgeCount,
                            paramCount,
                            metaCount
                        };
                    });

                    const rowsHtml = tableData.map((row, index) => `
                        <tr data-formula-index="${index}" data-formula-id="${escapeHtml(row.formulaId)}" style="cursor: pointer;">
                            <td>${escapeHtml(row.formulaId)}</td>
                            <td>${escapeHtml(row.formulaName)}</td>
                            <td>${row.nodeCount}</td>
                            <td>${row.edgeCount}</td>
                            <td>${row.paramCount}</td>
                            <td>${row.metaCount}</td>
                        </tr>
                    `).join('');

                    content.innerHTML = `
                        <div class="sb-count">${tableData.length} formulas loaded</div>
                        <div class="sb-tbl-scroll">
                            <table class="sb-tbl">
                                <thead>
                                    <tr>
                                        <th>FormulaId</th>
                                        <th>Name</th>
                                        <th>Nodes</th>
                                        <th>Edges</th>
                                        <th>Params</th>
                                        <th>MetaNodes</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>
                        </div>
                    `;

                    const rows = content.querySelectorAll('tbody tr[data-formula-index]');
                    rows.forEach(rowEl => {
                        rowEl.addEventListener('click', () => {
                            const idx = Number(rowEl.dataset.formulaIndex);
                            const selected = tableData[idx];
                            if (!selected) return;

                            ctx.formulaId = selected.formulaId;
                            ctx.formulaName = selected.formulaName;

                            rows.forEach(r => {
                                r.style.background = '';
                                r.style.outline = '';
                            });
                            rowEl.style.background = '#0e2038';
                            rowEl.style.outline = '1px solid #1a3a5a';

                            if (selectedFormulaLabel) {
                                selectedFormulaLabel.textContent = `Selected: ${selected.formulaName}`;
                            }

                            if (onFormulaSelect) {
                                onFormulaSelect(buildGraphDataFromFormula(selected.formula));
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Error loading formulas:', error);
                    content.textContent = `Error loading formulas: ${error.message}`;
                });
        }
    }
    
    function editParameters() {
        console.log('Editing parameters...');
        const content = document.getElementById('sb-params-preview');
        if (content) {
            content.textContent = JSON.stringify(ctx.parameters, null, 2);
        }
    }

    function showExecutePopup(result, requestBody, endpointUsed) {
        const title = document.getElementById('pkt-title');
        const body = document.getElementById('pkt-body');
        const panel = document.getElementById('pkt-panel');
        if (!title || !body || !panel) return;

        const lineItems = Array.isArray(result?.lineItems) ? result.lineItems : [];
        const rows = [
            ['FormulaId', result?.formulaId || requestBody?.formulaId || '-'],
            ['FormulaName', result?.formulaName || ctx.formulaName || '-'],
            ['Total', result?.total ?? '-'],
            ['LineItemsCount', lineItems.length],
            ['LineItems', lineItems.length ? JSON.stringify(lineItems) : '[]'],
            ['ElapsedMs', result?.elapsedMilliseconds ?? '-'],
            ['Endpoint', endpointUsed],
            ['Parameters', JSON.stringify(requestBody?.parameters || [])],
            ['PayableItemsUsed', Array.isArray(requestBody?.payableItems) ? requestBody.payableItems.length : 0]
        ];

        title.textContent = `EXECUTE RESULT · ${ctx.formulaName || ctx.formulaId || 'Unknown formula'}`;
        body.innerHTML = rows.map((entry, index) => `
            <tr>
                <td class="pc">${index + 1}</td>
                <td><code class="pt">RESULT</code></td>
                <td><code class="pt">${entry[0]}</code></td>
                <td class="pd"><span class="pv">${String(entry[1])}</span></td>
                <td class="pc">${new Date().toLocaleTimeString()}</td>
            </tr>
        `).join('');

        panel.style.display = 'flex';
    }

    function showExecuteErrorPopup(errorMessage, attempts) {
        const title = document.getElementById('pkt-title');
        const body = document.getElementById('pkt-body');
        const panel = document.getElementById('pkt-panel');
        if (!title || !body || !panel) return;

        title.textContent = `EXECUTE ERROR · ${ctx.formulaName || ctx.formulaId || 'Unknown formula'}`;
        const rows = [
            ['Error', errorMessage],
            ['FormulaId', ctx.formulaId || '-'],
            ['FormulaName', ctx.formulaName || '-'],
            ['Attempts', attempts.map(a => a.endpoint).join(' -> ')]
        ];

        body.innerHTML = rows.map((entry, index) => `
            <tr>
                <td class="pc">${index + 1}</td>
                <td><code class="pt">ERROR</code></td>
                <td><code class="pt">${entry[0]}</code></td>
                <td class="pd"><span class="pv">${String(entry[1])}</span></td>
                <td class="pc">${new Date().toLocaleTimeString()}</td>
            </tr>
        `).join('');

        panel.style.display = 'flex';
    }

    async function postExecute(endpoint, body, timeoutPromise) {
        const response = await Promise.race([
            fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(body)
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 300)}`);
        }

        return response.json();
    }

    async function executeFormula() {
        const resultBox = document.getElementById('sb-exec-result');
        if (!ctx.formulaId) {
            if (resultBox) resultBox.textContent = 'Select a formula first.';
            return;
        }

        if (execBtn) {
            execBtn.disabled = true;
            execBtn.textContent = '⏳ EXECUTING...';
        }
        if (resultBox) resultBox.textContent = 'Executing formula...';

        const basePayload = {
            formulaId: ctx.formulaId,
            parameters: ctx.parameters || []
        };

        const withMasterPayload = {
            ...basePayload,
            payableItems: Array.isArray(ctx.payableItems) ? ctx.payableItems : []
        };

        const executePayload = {
            ...basePayload,
            branchSystemId: ctx.masterData.branchSystemId,
            supplierIdSap: ctx.masterData.supplierIdSap,
            distributorDNI: ctx.masterData.distributorDNI,
            vehicleDomain: ctx.masterData.vehicleDomain,
            startDate: ctx.masterData.startDate,
            endDate: ctx.masterData.endDate
        };

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('API timeout')), 45000)
        );

        let endpointUsed = '';
        let requestBody = null;
        const attempts = [];

        try {
            const useMasterDataItems = Array.isArray(ctx.payableItems) && ctx.payableItems.length > 0;
            const endpointWithMasterData = `${ctx.proxyBase}/api/v1/FormulaGraph/execute-with-master-data`;
            const endpointExecute = `${ctx.proxyBase}/api/v1/FormulaGraph/execute`;

            let result;
            if (useMasterDataItems) {
                endpointUsed = endpointWithMasterData;
                requestBody = withMasterPayload;
                attempts.push({ endpoint: endpointUsed });
                try {
                    result = await postExecute(endpointUsed, requestBody, timeoutPromise);
                } catch (firstError) {
                    endpointUsed = endpointExecute;
                    requestBody = executePayload;
                    attempts.push({ endpoint: endpointUsed });
                    result = await postExecute(endpointUsed, requestBody, timeoutPromise);
                }
            } else {
                endpointUsed = endpointExecute;
                requestBody = executePayload;
                attempts.push({ endpoint: endpointUsed });
                result = await postExecute(endpointUsed, requestBody, timeoutPromise);
            }

            if (resultBox) {
                const total = result?.total ?? '-';
                const elapsed = result?.elapsedMilliseconds ?? '-';
                resultBox.textContent = `OK · total=${total} · ${elapsed}ms`;
            }
            showExecutePopup(result, requestBody, endpointUsed);
        } catch (error) {
            console.error('Execute formula error:', error);
            if (resultBox) resultBox.textContent = `Error: ${error.message}`;
            showExecuteErrorPopup(error.message, attempts);
        } finally {
            if (execBtn) {
                execBtn.disabled = false;
                execBtn.textContent = '▶ EXECUTE';
            }
        }
    }
    
    // Auto-load items, formulas, and parameters when sidebar is initialized
    loadItems();
    loadFormulas();
    editParameters();
    
    return sidebar;
}
