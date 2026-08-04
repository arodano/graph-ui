import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import allFormulasData from './data/allformulas.json';

const ICONS = {
  variable: 'VAR',
  constant: 'CST',
  parameter: 'PRM',
  operation: 'OP',
  filter: 'FL',
  aggregation: 'AG',
  quantitySpec: 'QS',
  aggregate: 'AGG',
  conditional: 'IF',
  compositeGroup: 'CG',
  output: 'OUT',
};

const STATUS_LABELS = { running: 'Running', idle: 'Idle', error: 'Error' };

const CHILD_NODE_WIDTH = 210;
const CHILD_NODE_HEIGHT = 110;
const CHILD_PADDING = 16;
const GROUP_HEADER_HEIGHT = 48;

function FlowNode({ data, selected }) {
  const kind = data.kind ?? 'operation';
  return (
    <div className={`custom-node ${kind} ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />

      <div className="node-header">
        <div className="node-icon">{ICONS[kind]}</div>
        <span className="node-type">{kind}</span>
      </div>

      <div className="node-name">{data.label}</div>

      {data.status && (
        <div className={`node-status ${data.status}`}>
          <span className="status-dot" />
          {STATUS_LABELS[data.status]}
        </div>
      )}

      {data.fields && (
        <div className="node-body">
          {data.fields.map(([k, v]) => (
            <div className="node-field" key={k}>
              <span className="field-key">{k}</span>
              <span className="field-value">{v}</span>
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function CompositeGroupNode({ data, selected }) {
  return (
    <div
      className={`composite-group-node ${selected ? 'selected' : ''}`}
      style={{ width: data.groupWidth, height: data.groupHeight }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="composite-group-header">
        <div className="node-icon">{ICONS.compositeGroup}</div>
        <span className="composite-group-name">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode, compositeGroupNode: CompositeGroupNode };

const NODE_KIND_TO_UI_KIND = {
  VariableInput: 'variable',
  ParameterInput: 'parameter',
  ConstantInput: 'constant',
  MathOperation: 'operation',
  Filter: 'filter',
  Grouping: 'aggregation',
  QuantitySpecInput: 'quantitySpec',
  Aggregate: 'aggregate',
  Conditional: 'conditional',
  CompositeGroup: 'compositeGroup',
  Output: 'output',
};

const UI_KIND_COLORS = {
  variable: 'rgba(0,180,216,0.5)',
  constant: 'rgba(240,144,77,0.5)',
  parameter: 'rgba(160,110,240,0.5)',
  operation: 'rgba(56,139,253,0.5)',
  filter: 'rgba(210,153,34,0.5)',
  aggregation: 'rgba(35,197,134,0.5)',
  quantitySpec: 'rgba(20,210,160,0.5)',
  aggregate: 'rgba(100,200,80,0.5)',
  conditional: 'rgba(255,170,0,0.5)',
  compositeGroup: 'rgba(230,80,230,0.5)',
  output: 'rgba(240,80,110,0.5)',
};

function buildFlowFromFormula(formula) {
  const nodes = formula?.Nodes ?? [];
  const edges = formula?.Edges ?? [];
  const parameterDefinitions = formula?.ParameterDefinitions ?? [];
  const compositeNodeMembers = formula?.CompositeNodeMembers ?? [];
  const compositeEdgeMembers = formula?.CompositeEdgeMembers ?? [];

  // Build lookup maps: compositeNodeId -> full member entries
  const compositeNodeMembersMap = new Map();
  for (const entry of compositeNodeMembers) {
    const list = compositeNodeMembersMap.get(entry.CompositeNodeId) ?? [];
    list.push(entry);
    compositeNodeMembersMap.set(entry.CompositeNodeId, list);
  }
  const compositeEdgeMembersMap = new Map();
  for (const entry of compositeEdgeMembers) {
    const list = compositeEdgeMembersMap.get(entry.CompositeNodeId) ?? [];
    list.push(entry.MemberEdgeId);
    compositeEdgeMembersMap.set(entry.CompositeNodeId, list);
  }

  const parameterByName = new Map(
    parameterDefinitions.map((parameterDefinition) => [
      parameterDefinition.ParameterName,
      parameterDefinition,
    ]),
  );

  const inDegree = new Map(nodes.map((node) => [node.Id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.Id, []]));

  for (const edge of edges) {
    inDegree.set(edge.ToNodeId, (inDegree.get(edge.ToNodeId) ?? 0) + 1);
    const fromEdges = outgoing.get(edge.FromNodeId);
    if (fromEdges) {
      fromEdges.push(edge);
    }
  }

  const queue = [];
  const levelByNodeId = new Map();

  for (const node of nodes) {
    if ((inDegree.get(node.Id) ?? 0) === 0) {
      queue.push(node.Id);
      levelByNodeId.set(node.Id, 0);
    }
  }

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    const currentLevel = levelByNodeId.get(currentNodeId) ?? 0;
    const outgoingEdges = outgoing.get(currentNodeId) ?? [];

    for (const edge of outgoingEdges) {
      const nextNodeId = edge.ToNodeId;
      levelByNodeId.set(nextNodeId, Math.max(levelByNodeId.get(nextNodeId) ?? 0, currentLevel + 1));
      inDegree.set(nextNodeId, (inDegree.get(nextNodeId) ?? 0) - 1);
      if ((inDegree.get(nextNodeId) ?? 0) === 0) {
        queue.push(nextNodeId);
      }
    }
  }

  const layerCounts = new Map();
  const childNodes = [];

  const reactFlowNodes = nodes.map((node) => {
    const layer = levelByNodeId.get(node.Id) ?? 0;
    const row = layerCounts.get(layer) ?? 0;
    layerCounts.set(layer, row + 1);

    const uiKind = NODE_KIND_TO_UI_KIND[node.NodeKind] ?? 'operation';
    const nodeData = node.NodeData ? JSON.parse(node.NodeData) : {};

    if (node.NodeKind === 'CompositeGroup') {
      const members = compositeNodeMembersMap.get(node.Id) ?? [];
      const memberEdges = compositeEdgeMembersMap.get(node.Id) ?? [];

      const cols = Math.max(1, Math.ceil(Math.sqrt(members.length)));
      const rows = Math.max(1, Math.ceil(members.length / cols));
      const groupWidth = cols * (CHILD_NODE_WIDTH + CHILD_PADDING) + CHILD_PADDING;
      const groupHeight = GROUP_HEADER_HEIGHT + rows * (CHILD_NODE_HEIGHT + CHILD_PADDING) + CHILD_PADDING;

      members.forEach((member, i) => {
        const col = i % cols;
        const memberRow = Math.floor(i / cols);
        const memberNodeData = member.MemberNodeData ? JSON.parse(member.MemberNodeData) : {};
        const memberUiKind = NODE_KIND_TO_UI_KIND[member.MemberNodeKind] ?? 'operation';

        const memberFields = [];
        if (member.MemberNodeKind === 'VariableInput') {
          memberFields.push(['data source', memberNodeData.DataSource ?? '-']);
          memberFields.push(['field', memberNodeData.FieldName ?? '-']);
        } else if (member.MemberNodeKind === 'ConstantInput') {
          memberFields.push(['name', memberNodeData.ConstantName ?? '-']);
          memberFields.push(['value', memberNodeData.Value ?? '-']);
          memberFields.push(['type', memberNodeData.ValueType ?? '-']);
        } else if (member.MemberNodeKind === 'ParameterInput') {
          memberFields.push(['param', memberNodeData.ParameterName ?? '-']);
          memberFields.push(['type', memberNodeData.ValueType ?? '-']);
        } else if (member.MemberNodeKind === 'MathOperation') {
          memberFields.push(['operation', memberNodeData.Operation ?? '-']);
        } else if (member.MemberNodeKind === 'Grouping') {
          memberFields.push(['group by', memberNodeData.GroupByFieldName ?? '-']);
        } else if (member.MemberNodeKind === 'Filter') {
          memberFields.push(['expression', memberNodeData.FilterExpression ?? '-']);
        } else if (member.MemberNodeKind === 'QuantitySpecInput') {
          memberFields.push(['field', memberNodeData.FieldName ?? '-']);
          memberFields.push(['aggregation', memberNodeData.Aggregation ?? '-']);
        } else if (member.MemberNodeKind === 'Aggregate') {
          memberFields.push(['operation', memberNodeData.AggregateOperationKind ?? '-']);
        } else if (member.MemberNodeKind === 'Conditional') {
          memberFields.push(['predicate', memberNodeData.predicate ?? '-']);
        }

        childNodes.push({
          id: `${node.Id}__child__${member.MemberNodeId}__${i}`,
          type: 'flowNode',
          parentId: node.Id,
          extent: 'parent',
          position: {
            x: CHILD_PADDING + col * (CHILD_NODE_WIDTH + CHILD_PADDING),
            y: GROUP_HEADER_HEIGHT + memberRow * (CHILD_NODE_HEIGHT + CHILD_PADDING),
          },
          data: {
            kind: memberUiKind,
            label: member.MemberLabel,
            fields: memberFields,
          },
          style: { width: CHILD_NODE_WIDTH },
        });
      });

      return {
        id: node.Id,
        type: 'compositeGroupNode',
        position: { x: 80 + layer * 300, y: 120 + row * 170 },
        data: {
          label: nodeData.CompositeGroupName ?? node.Label,
          groupWidth,
          groupHeight,
          memberCount: members.length,
          memberEdgeCount: memberEdges.length,
        },
        style: { width: groupWidth, height: groupHeight },
        zIndex: -1,
      };
    }

    const fields = [];

    if (node.NodeKind === 'VariableInput') {
      fields.push(['data source', nodeData.DataSource ?? '-']);
      fields.push(['field', nodeData.FieldName ?? '-']);
    } else if (node.NodeKind === 'ConstantInput') {
      fields.push(['name', nodeData.ConstantName ?? '-']);
      fields.push(['value', nodeData.Value ?? '-']);
      fields.push(['type', nodeData.ValueType ?? '-']);
    } else if (node.NodeKind === 'ParameterInput') {
      fields.push(['param name', nodeData.ParameterName ?? '-']);
      fields.push(['value type', nodeData.ValueType ?? '-']);
      const parameterDefinition = parameterByName.get(nodeData.ParameterName);
      if (parameterDefinition?.Description) {
        fields.push(['description', parameterDefinition.Description]);
      }
    } else if (node.NodeKind === 'MathOperation') {
      fields.push(['operation', nodeData.Operation ?? '-']);
    } else if (node.NodeKind === 'Grouping') {
      fields.push(['group by', nodeData.GroupByFieldName ?? '-']);
    } else if (node.NodeKind === 'Filter') {
      fields.push(['expression', nodeData.FilterExpression ?? '-']);
    } else if (node.NodeKind === 'QuantitySpecInput') {
      fields.push(['field', nodeData.FieldName ?? '-']);
      fields.push(['aggregation', nodeData.Aggregation ?? '-']);
    } else if (node.NodeKind === 'Aggregate') {
      fields.push(['operation', nodeData.AggregateOperationKind ?? '-']);
    } else if (node.NodeKind === 'Conditional') {
      fields.push(['predicate', nodeData.predicate ?? '-']);
    }

    return {
      id: node.Id,
      type: 'flowNode',
      position: { x: 80 + layer * 300, y: 120 + row * 170 },
      data: {
        kind: uiKind,
        label: node.Label,
        fields,
      },
    };
  });

  // Composite group nodes must come before their children in the array
  const allReactFlowNodes = [...reactFlowNodes, ...childNodes];

  const nodeMap = new Map(nodes.map((node) => [node.Id, node]));
  const sortedEdges = [...edges].sort((a, b) => {
    if (a.ToNodeId === b.ToNodeId) {
      return a.Order - b.Order;
    }
    return a.Id.localeCompare(b.Id);
  });

  const reactFlowEdges = sortedEdges.map((edge) => {
    const fromNode = nodeMap.get(edge.FromNodeId);
    const fromKind = NODE_KIND_TO_UI_KIND[fromNode?.NodeKind] ?? 'operation';
    return {
      id: edge.Id,
      source: edge.FromNodeId,
      target: edge.ToNodeId,
      animated: true,
      label: `#${edge.Order}`,
      style: { stroke: UI_KIND_COLORS[fromKind] ?? 'rgba(120,128,144,0.5)' },
    };
  });

  return { nodes: allReactFlowNodes, edges: reactFlowEdges };
}

const FORMULA_LABELS = {
  '22222222-0000-0000-0000-000000000001': 'Filter + Group by Polygon',
  '11111111-0000-0000-0000-000000000001': 'Price by Container',
  '77777777-0000-0000-0000-000000000001': 'Concept Filter',
  '55555555-0000-0000-0000-000000000001': 'Tarifa por Radio (Composite)',
  '88888888-0000-0000-0000-000000000001': 'Encomiendas por Peso',
  '66666666-0000-0000-0000-000000000001': 'Tarifa Radio (Conditional)',
  '44444444-0000-0000-0000-000000000001': 'Radio Bounds Filter',
  '33333333-0000-0000-0000-000000000001': 'Tariff A/B by Weight',
};

const FORMULAS = (allFormulasData.Formulas ?? []).map((f) => ({
  label: FORMULA_LABELS[f.FormulaId] ?? f.FormulaId,
  data: f,
}));

function FlowCanvas({ formula }) {
  const { nodes: initialNodes, edges: initialEdges } = buildFlowFromFormula(formula.data);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="rgba(255,255,255,0.04)"
      />
      <Controls position="bottom-left" />
      <MiniMap
        position="bottom-right"
        nodeColor={(n) => {
          const map = {
            variable: '#00b4d8',
            constant: '#f0904d',
            parameter: '#a06ef0',
            operation: '#388bfd',
            filter: '#d29922',
            aggregation: '#23c586',
            quantitySpec: '#14d2a0',
            aggregate: '#64c850',
            conditional: '#ffaa00',
            compositeGroup: '#e650e6',
            output: '#f0506e',
          };
          return map[n.data?.kind] ?? '#4a5268';
        }}
        maskColor="rgba(11,13,18,0.85)"
      />
    </ReactFlow>
  );
}

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const formula = FORMULAS[selectedIndex];
  const { nodes: initialNodes, edges: initialEdges } = buildFlowFromFormula(formula.data);

  return (
    <div className="flow-wrapper">
      <div className="flow-header">
        <h1>FlowGraph</h1>
        <div className="formula-tabs">
          {FORMULAS.map((f, i) => (
            <button
              key={f.label}
              className={`formula-tab ${i === selectedIndex ? 'active' : ''}`}
              onClick={() => setSelectedIndex(i)}
              type='button'
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="subtitle">
          {formula.data?.FormulaId} &mdash; {initialNodes.length} nodes &middot; {initialEdges.length} edges
        </span>
      </div>

      <FlowCanvas key={selectedIndex} formula={formula} />
    </div>
  );
}
