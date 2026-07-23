import { useEffect, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
} from '@xyflow/react';
import {
  CANVAS_WIDTH,
  EFFECT_COLOURS,
  NODE_HEIGHT,
  NODE_WIDTH,
  TIER_HEIGHT,
  TIER_LABEL_WIDTH,
} from '../constants.js';

const HANDLE_STYLE = {
  width: 8,
  height: 8,
  opacity: 0,
  pointerEvents: 'none',
};

function ConceptCardNode({ data, selected }) {
  const aggregate = data.aggregate;
  const classNames = [
    'concept-card',
    selected ? 'is-selected' : '',
    data.isLinkSource ? 'is-link-source' : '',
    data.linkMode ? 'link-mode-active' : '',
    data.origin === 'participant' ? 'is-custom' : 'is-starter',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classNames} aria-label={data.title}>
      <Handle type="target" position={Position.Top} id="t-top" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Top} id="s-top" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Right} id="t-right" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="s-right" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="t-left" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left} id="s-left" style={HANDLE_STYLE} />

      <div className="card-topline">
        <span className={`origin-badge ${data.origin === 'participant' ? 'custom' : 'starter'}`}>
          {data.origin === 'participant' ? 'Added' : 'S&G 2022'}
        </span>
        {aggregate ? (
          <span className="aggregate-badge" title="Number of maps containing this card">
            n={aggregate.nominationCount}
          </span>
        ) : null}
      </div>
      <h3>{data.title}</h3>
      <p>{data.description || 'No definition supplied.'}</p>
      <button
        type="button"
        className="card-info-button nodrag nopan"
        onClick={(event) => {
          event.stopPropagation();
          data.onInfo?.(data.id);
        }}
        aria-label={`Inspect ${data.title}`}
      >
        i
      </button>
      {data.isLinkSource ? <span className="link-source-flag">Source</span> : null}
    </article>
  );
}

function WeightedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
  selected,
}) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const curveOffset = data?.hasReverse ? 34 : 0;
  const controlX = (sourceX + targetX) / 2 + normalX * curveOffset;
  const controlY = (sourceY + targetY) / 2 + normalY * curveOffset;
  const edgePath = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;
  const labelX = 0.25 * sourceX + 0.5 * controlX + 0.25 * targetX;
  const labelY = 0.25 * sourceY + 0.5 * controlY + 0.25 * targetY;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, filter: selected ? 'drop-shadow(0 0 3px rgba(16,35,63,.45))' : undefined }}
        interactionWidth={24}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`edge-label nodrag nopan ${selected ? 'is-selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onClick={(event) => {
            event.stopPropagation();
            data?.onSelect?.(id);
          }}
          aria-label={`Inspect connection ${data?.label || ''}`}
        >
          {data?.label}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { conceptCard: ConceptCardNode };
const edgeTypes = { weighted: WeightedEdge };

function routeHandles(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) {
    return { sourceHandle: 's-bottom', targetHandle: 't-top' };
  }
  const sourceCentre = {
    x: sourceNode.position.x + NODE_WIDTH / 2,
    y: sourceNode.position.y + NODE_HEIGHT / 2,
  };
  const targetCentre = {
    x: targetNode.position.x + NODE_WIDTH / 2,
    y: targetNode.position.y + NODE_HEIGHT / 2,
  };
  const dx = targetCentre.x - sourceCentre.x;
  const dy = targetCentre.y - sourceCentre.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 's-right', targetHandle: 't-left' }
      : { sourceHandle: 's-left', targetHandle: 't-right' };
  }
  return dy >= 0
    ? { sourceHandle: 's-bottom', targetHandle: 't-top' }
    : { sourceHandle: 's-top', targetHandle: 't-bottom' };
}

function BoardInner({
  tiers,
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  linkMode = false,
  linkSourceId = null,
  readOnly = false,
  onNodeActivate,
  onNodeInspect,
  onNodeMove,
  onEdgeSelect,
  onPaneClick,
  emptyMessage = 'No cards to display.',
}) {
  const boardHeight = tiers.length * TIER_HEIGHT;

  const mappedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: 'conceptCard',
        position: node.position,
        selected: selectedNodeId === node.id,
        draggable: !readOnly,
        selectable: true,
        focusable: true,
        data: {
          id: node.id,
          title: node.title,
          description: node.description,
          origin: node.origin,
          aggregate: node.aggregate,
          isLinkSource: linkSourceId === node.id,
          linkMode,
          onInfo: onNodeInspect,
        },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      })),
    [nodes, selectedNodeId, readOnly, linkSourceId, linkMode, onNodeInspect],
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(mappedNodes);

  useEffect(() => {
    setFlowNodes(mappedNodes);
  }, [mappedNodes, setFlowNodes]);

  const flowNodeById = useMemo(() => new Map(flowNodes.map((node) => [node.id, node])), [flowNodes]);

  const mappedEdges = useMemo(() => {
    const directedPairs = new Set(edges.map((edge) => `${edge.source}→${edge.target}`));
    return edges.map((edge) => {
      const colour = EFFECT_COLOURS[edge.effect] || EFFECT_COLOURS.unspecified;
      const route = routeHandles(flowNodeById.get(edge.source), flowNodeById.get(edge.target));
      const displayWeight = Number.isFinite(Number(edge.displayWeight))
        ? Number(edge.displayWeight)
        : Number(edge.strength || 1);
      const aggregatePrevalence = edge.aggregate?.prevalenceAll;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'weighted',
        selected: selectedEdgeId === edge.id,
        sourceHandle: route.sourceHandle,
        targetHandle: route.targetHandle,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: colour,
          width: 18,
          height: 18,
        },
        style: {
          stroke: colour,
          strokeWidth: 1.3 + Math.max(0.25, displayWeight) * 0.9,
          opacity: aggregatePrevalence == null ? 0.88 : 0.28 + 0.72 * aggregatePrevalence,
        },
        data: {
          ...edge,
          label: edge.label || String(edge.strength),
          hasReverse: directedPairs.has(`${edge.target}→${edge.source}`),
          onSelect: onEdgeSelect,
        },
      };
    });
  }, [edges, flowNodeById, selectedEdgeId, onEdgeSelect]);

  const handleDragStop = (_event, node) => {
    if (readOnly) return;
    const centreY = node.position.y + NODE_HEIGHT / 2;
    const tierIndex = Math.max(0, Math.min(tiers.length - 1, Math.floor(centreY / TIER_HEIGHT)));
    const tier = tiers[tierIndex];
    const minY = tierIndex * TIER_HEIGHT + 12;
    const maxY = (tierIndex + 1) * TIER_HEIGHT - NODE_HEIGHT - 12;
    const position = {
      x: Math.max(TIER_LABEL_WIDTH + 18, Math.min(CANVAS_WIDTH - NODE_WIDTH - 22, node.position.x)),
      y: Math.max(minY, Math.min(maxY, node.position.y)),
    };
    setFlowNodes((current) =>
      current.map((candidate) => (candidate.id === node.id ? { ...candidate, position } : candidate)),
    );
    onNodeMove?.(node.id, position, tier.id);
  };

  return (
    <div className="board-scroll" aria-label="Hierarchical concept-mapping board">
      <div className="board-canvas" style={{ width: CANVAS_WIDTH, height: boardHeight }}>
        <div className="tier-bands" aria-hidden="true">
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className={`tier-band ${tier.kind === 'unplaced' ? 'unplaced' : ''}`}
              style={{ top: index * TIER_HEIGHT, height: TIER_HEIGHT }}
            >
              <div className="tier-label">
                <strong>{tier.label}</strong>
                {tier.kind === 'ranked' ? <span>Hierarchy level {(tier.order ?? index) + 1}</span> : <span>Drag cards from here</span>}
              </div>
            </div>
          ))}
        </div>
        {nodes.length ? (
          <ReactFlow
            nodes={flowNodes}
            edges={mappedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onNodeDragStop={handleDragStop}
            onNodeClick={(event, node) => {
              event.stopPropagation();
              onNodeActivate?.(node.id);
            }}
            onEdgeClick={(event, edge) => {
              event.stopPropagation();
              onEdgeSelect?.(edge.id);
            }}
            onPaneClick={onPaneClick}
            nodesDraggable={!readOnly}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            minZoom={1}
            maxZoom={1}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            deleteKeyCode={null}
            multiSelectionKeyCode={null}
            selectionOnDrag={false}
            selectNodesOnDrag={false}
            nodeDragThreshold={4}
            fitView={false}
            className={linkMode ? 'link-mode' : ''}
          />
        ) : (
          <div className="empty-board">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}

export default function HierarchyBoard(props) {
  return (
    <ReactFlowProvider>
      <BoardInner {...props} />
    </ReactFlowProvider>
  );
}
