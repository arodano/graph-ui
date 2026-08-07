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

      {data.meta && (
        <>
          <div className="node-meta-divider" />
          <div className="node-meta-title">Metadata</div>
          <div className="node-body">
            {data.meta.GroupExpr && (
              <div className="node-field">
                <span className="field-key">group</span>
                <span className="field-value">{data.meta.GroupExpr}</span>
              </div>
            )}
            {data.meta.ServiceExpr && (
              <div className="node-field">
                <span className="field-key">service</span>
                <span className="field-value">{data.meta.ServiceExpr}</span>
              </div>
            )}
            {data.meta.AdditionalInfoExpr && (
              <div className="node-field">
                <span className="field-key">info</span>
                <span className="field-value">{data.meta.AdditionalInfoExpr}</span>
              </div>
            )}
          </div>
        </>
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
      <Handle id="ext-target" type="target" position={Position.Left} />
      <Handle id="inner-source" type="source" position={Position.Left} style={{ opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, padding: 0 }} />
      <div className="composite-group-header">
        <div className="node-icon">{ICONS.compositeGroup}</div>
        <span className="composite-group-name">{data.label}</span>
      </div>
      <Handle id="ext-source" type="source" position={Position.Right} />
      <Handle id="inner-target" type="target" position={Position.Right} style={{ opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, padding: 0 }} />
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
  const metaNodes = formula?.MetaNodes ?? [];
  const metaByNodeId = new Map(metaNodes.map((m) => [m.AssociatedNodeId, m]));

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

  const compositeMemberNodeIds = new Set(compositeNodeMembers.map((entry) => entry.MemberNodeId));
  const edgeById = new Map(edges.map((edge) => [edge.Id, edge]));
  const compositeMemberEdgeIds = new Set(compositeEdgeMembers.map((entry) => entry.MemberEdgeId));
  const visibleNodes = nodes.filter((node) => !compositeMemberNodeIds.has(node.Id));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.Id));
  const visibleEdges = edges.filter(
    (edge) =>
      !compositeMemberEdgeIds.has(edge.Id) &&
      visibleNodeIds.has(edge.FromNodeId) &&
      visibleNodeIds.has(edge.ToNodeId),
  );

  const parameterByName = new Map(
    parameterDefinitions.map((parameterDefinition) => [
      parameterDefinition.ParameterName,
      parameterDefinition,
    ]),
  );

  const inDegree = new Map(visibleNodes.map((node) => [node.Id, 0]));
  const outgoing = new Map(visibleNodes.map((node) => [node.Id, []]));

  for (const edge of visibleEdges) {
    inDegree.set(edge.ToNodeId, (inDegree.get(edge.ToNodeId) ?? 0) + 1);
    const fromEdges = outgoing.get(edge.FromNodeId);
    if (fromEdges) {
      fromEdges.push(edge);
    }
  }

  const queue = [];
  const levelByNodeId = new Map();

  for (const node of visibleNodes) {
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
  const childNodeIdByCompositeNode = new Map();

  const reactFlowNodes = visibleNodes.map((node) => {
    const layer = levelByNodeId.get(node.Id) ?? 0;
    const row = layerCounts.get(layer) ?? 0;
    layerCounts.set(layer, row + 1);

    const uiKind = NODE_KIND_TO_UI_KIND[node.NodeKind] ?? 'operation';
    const nodeData = node.NodeData ? JSON.parse(node.NodeData) : {};

    if (node.NodeKind === 'CompositeGroup') {
      const members = compositeNodeMembersMap.get(node.Id) ?? [];
      const memberEdges = compositeEdgeMembersMap.get(node.Id) ?? [];
      const childNodeIdByMemberNodeId = new Map();

      const cols = Math.max(1, Math.ceil(Math.sqrt(members.length)));
      const rows = Math.max(1, Math.ceil(members.length / cols));
      const groupWidth = cols * (CHILD_NODE_WIDTH + CHILD_PADDING) + CHILD_PADDING;
      const groupHeight = GROUP_HEADER_HEIGHT + rows * (CHILD_NODE_HEIGHT + CHILD_PADDING) + CHILD_PADDING;

      members.forEach((member, i) => {
        const col = i % cols;
        const memberRow = Math.floor(i / cols);
        const memberNodeData = member.MemberNodeData ? JSON.parse(member.MemberNodeData) : {};
        const memberUiKind = NODE_KIND_TO_UI_KIND[member.MemberNodeKind] ?? 'operation';
        const childNodeId = `${node.Id}__child__${member.MemberNodeId}`;

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
          id: childNodeId,
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
            meta: metaByNodeId.get(member.MemberNodeId) ?? null,
          },
          style: { width: CHILD_NODE_WIDTH },
        });

        childNodeIdByMemberNodeId.set(member.MemberNodeId, childNodeId);
      });

      childNodeIdByCompositeNode.set(node.Id, childNodeIdByMemberNodeId);

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
        meta: metaByNodeId.get(node.Id) ?? null,
      },
    };
  });

  // Composite group nodes must come before their children in the array
  const allReactFlowNodes = [...reactFlowNodes, ...childNodes];

  const nodeMap = new Map(visibleNodes.map((node) => [node.Id, node]));
  const sortedEdges = [...visibleEdges]
    .sort((a, b) => {
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
      ...(fromNode?.NodeKind === 'CompositeGroup' && { sourceHandle: 'ext-source' }),
      target: edge.ToNodeId,
      animated: true,
      label: `#${edge.Order}`,
      style: { stroke: UI_KIND_COLORS[fromKind] ?? 'rgba(120,128,144,0.5)' },
    };
  });

  const compositeInnerEdges = [];
  for (const [compositeNodeId, memberEdgeIds] of compositeEdgeMembersMap.entries()) {
    const members = compositeNodeMembersMap.get(compositeNodeId) ?? [];
    const childIdsByMemberNodeId = childNodeIdByCompositeNode.get(compositeNodeId);
    if (!childIdsByMemberNodeId) {
      continue;
    }

    const memberById = new Map(members.map((member) => [member.MemberNodeId, member]));

    memberEdgeIds.forEach((memberEdgeId, index) => {
      const memberEdge = edgeById.get(memberEdgeId);
      if (!memberEdge) {
        return;
      }

      const source = childIdsByMemberNodeId.get(memberEdge.FromNodeId);
      const target = childIdsByMemberNodeId.get(memberEdge.ToNodeId);
      if (!source || !target) {
        return;
      }

      const sourceMember = memberById.get(memberEdge.FromNodeId);
      const sourceKind = NODE_KIND_TO_UI_KIND[sourceMember?.MemberNodeKind] ?? 'operation';

      compositeInnerEdges.push({
        id: `${compositeNodeId}__inner__${memberEdge.Id}__${index}`,
        source,
        target,
        animated: true,
        label: `#${memberEdge.Order}`,
        style: { stroke: UI_KIND_COLORS[sourceKind] ?? 'rgba(120,128,144,0.5)' },
      });
    });
  }

  const compositeEntryExitEdges = [];
  for (const node of visibleNodes) {
    if (node.NodeKind !== 'CompositeGroup') continue;
    const nodeData = node.NodeData ? JSON.parse(node.NodeData) : {};
    const entryNodeId = nodeData.EntryNodeId;
    const exitNodeId = nodeData.ExitNodeId;
    const childIdsByMemberNodeId = childNodeIdByCompositeNode.get(node.Id);
    if (!childIdsByMemberNodeId) continue;

    if (entryNodeId) {
      const entryChildNodeId = childIdsByMemberNodeId.get(entryNodeId);
      if (entryChildNodeId) {
        compositeEntryExitEdges.push({
          id: `${node.Id}__entry__${entryNodeId}`,
          source: node.Id,
          sourceHandle: 'inner-source',
          target: entryChildNodeId,
          animated: false,
          style: { stroke: 'rgba(230,80,230,0.5)', strokeDasharray: '5 3' },
        });
      }
    }

    if (exitNodeId) {
      const exitChildNodeId = childIdsByMemberNodeId.get(exitNodeId);
      if (exitChildNodeId) {
        compositeEntryExitEdges.push({
          id: `${node.Id}__exit__${exitNodeId}`,
          source: exitChildNodeId,
          target: node.Id,
          targetHandle: 'inner-target',
          animated: false,
          style: { stroke: 'rgba(230,80,230,0.5)', strokeDasharray: '5 3' },
        });
      }
    }
  }

  return { nodes: allReactFlowNodes, edges: [...reactFlowEdges, ...compositeInnerEdges, ...compositeEntryExitEdges] };
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
        zoomable 
        pannable
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
