import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APP_NAME,
  APP_CONFIG,
  APP_VERSION,
  CONNECTOR_TYPES,
  NODE_HEIGHT,
  NODE_WIDTH,
  SOURCE_FRAMEWORK,
  TIER_HEIGHT,
  TIER_LABEL_WIDTH,
  THEME_KEY,
} from './constants.js';
import { normaliseLabel } from './aggregation.js';
import {
  arrangeNodes,
  countReciprocalPairs,
  createId,
  downloadStudy,
  loadSavedStudy,
  makeDefaultStudy,
  normaliseStudy,
  saveStudy,
} from './state.js';
import AggregateView from './components/AggregateView.jsx';
import HierarchyBoard from './components/HierarchyBoard.jsx';
import Modal from './components/Modal.jsx';

function formatTime(date) {
  return date ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

function initialTheme() {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function nextPosition(study, tierId, excludingNodeId = null) {
  const tierIndex = Math.max(0, study.tiers.findIndex((tier) => tier.id === tierId));
  const peers = study.nodes.filter((node) => node.tierId === tierId && node.id !== excludingNodeId);
  const visibleColumns = 4;
  const index = peers.length;
  const baseCapacity = visibleColumns * 2;
  const col = index < baseCapacity
    ? index % visibleColumns
    : visibleColumns + Math.floor((index - baseCapacity) / 2);
  const row = index < baseCapacity
    ? Math.floor(index / visibleColumns)
    : (index - baseCapacity) % 2;
  return {
    x: TIER_LABEL_WIDTH + 30 + col * (NODE_WIDTH + 16),
    y: Math.min(
      tierIndex * TIER_HEIGHT + 16 + row * (NODE_HEIGHT + 16),
      (tierIndex + 1) * TIER_HEIGHT - NODE_HEIGHT - 12,
    ),
  };
}

function CardForm({ initial, existingTitles, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Give the card a title.');
      return;
    }
    const key = normaliseLabel(cleanTitle);
    const duplicate = existingTitles.some((candidate) => normaliseLabel(candidate) === key);
    if (duplicate) {
      setError('A card with the same normalised title already exists. Edit that card or use a distinct title.');
      return;
    }
    onSubmit({ title: cleanTitle, description: description.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <label>
        <span>Card title</span>
        <input
          autoFocus
          type="text"
          value={title}
          maxLength={100}
          onChange={(event) => {
            setTitle(event.target.value);
            setError('');
          }}
          placeholder="e.g. Interoceptive prediction"
        />
      </label>
      <label>
        <span>Working definition</span>
        <textarea
          value={description}
          maxLength={600}
          rows={5}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Define what this card denotes so another analyst can interpret it later."
        />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button">{initial ? 'Save card' : 'Add card'}</button>
      </div>
    </form>
  );
}

function EdgeForm({ sourceNode, targetNode, initial, onSubmit, onCancel }) {
  const [strength, setStrength] = useState(initial?.strength || 3);
  const [confidence, setConfidence] = useState(initial?.confidence || 3);
  const [context, setContext] = useState(initial?.context || '');

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          strength: Number(strength),
          confidence: Number(confidence),
          context: context.trim(),
        });
      }}
    >
      <div className="edge-direction-summary">
        <strong>{sourceNode.title}</strong>
        <span aria-hidden="true">
          {CONNECTOR_TYPES.find((connector) => connector.id === 'unidirectional')?.symbol || '→'}
        </span>
        <strong>{targetNode.title}</strong>
      </div>
      <label className="range-field">
        <span>Connection strength: <strong>{strength}</strong>/5</span>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={strength}
          onChange={(event) => setStrength(Number(event.target.value))}
        />
        <small><span>Weak</span><span>Strong</span></small>
      </label>
      <label className="range-field">
        <span>Confidence in this judgement: <strong>{confidence}</strong>/5</span>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={confidence}
          onChange={(event) => setConfidence(Number(event.target.value))}
        />
        <small><span>Low</span><span>High</span></small>
      </label>
      <label>
        <span>{APP_CONFIG.connection.contextLabel}</span>
        <textarea
          value={context}
          maxLength={1000}
          rows={5}
          onChange={(event) => setContext(event.target.value)}
          placeholder={APP_CONFIG.connection.contextPlaceholder}
        />
      </label>
      <p className="method-note">
        {CONNECTOR_TYPES.find((connector) => connector.id === 'bidirectional')?.description}
      </p>
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button">{initial ? 'Save connection' : 'Add connection'}</button>
      </div>
    </form>
  );
}

function SetupForm({ study, onSubmit, onCancel }) {
  const [title, setTitle] = useState(study.study.title);
  const [participantId, setParticipantId] = useState(study.study.participantId);
  const [participantGroup, setParticipantGroup] = useState(study.study.participantGroup);
  const [hierarchyPrompt, setHierarchyPrompt] = useState(study.study.hierarchyPrompt);
  const [notes, setNotes] = useState(study.study.notes);
  const [rankedTiers, setRankedTiers] = useState(
    study.tiers.filter((tier) => tier.kind === 'ranked').map((tier) => ({ ...tier })),
  );

  function relabelBoundaryHints(tiers) {
    return tiers.map((tier, index) => ({
      ...tier,
      order: index,
    }));
  }

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          study: {
            title: title.trim() || APP_CONFIG.app.studyTitle,
            participantId: participantId.trim(),
            participantGroup: participantGroup.trim(),
            hierarchyPrompt: hierarchyPrompt.trim(),
            notes: notes.trim(),
          },
          rankedTiers,
        });
      }}
    >
      <div className="form-grid two-columns">
        <label>
          <span>Study/session title</span>
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Participant code</span>
          <input
            type="text"
            value={participantId}
            onChange={(event) => setParticipantId(event.target.value)}
            placeholder="Use a pseudonymous code"
          />
        </label>
        <label>
          <span>Participant group (optional)</span>
          <input
            type="text"
            value={participantGroup}
            onChange={(event) => setParticipantGroup(event.target.value)}
            placeholder="e.g. clinician, computational modeller"
          />
        </label>
      </div>
      <label>
        <span>Hierarchy instruction shown above the board</span>
        <textarea rows={4} value={hierarchyPrompt} onChange={(event) => setHierarchyPrompt(event.target.value)} />
      </label>
      <fieldset className="tier-editor">
        <legend>Ranked tiers</legend>
        {rankedTiers.map((tier, index) => (
          <label key={tier.id} className="tier-label-input">
            <span>{index + 1}</span>
            <input
              type="text"
              value={tier.label}
              onChange={(event) =>
                setRankedTiers((current) =>
                  current.map((candidate) =>
                    candidate.id === tier.id ? { ...candidate, label: event.target.value } : candidate,
                  ),
                )
              }
            />
          </label>
        ))}
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setRankedTiers((current) =>
                relabelBoundaryHints([
                  ...current,
                  {
                    id: createId('tier'),
                    label: `Tier ${current.length + 1}`,
                    kind: 'ranked',
                    order: current.length,
                  },
                ]),
              )
            }
          >
            + Add tier
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={rankedTiers.length <= 2}
            onClick={() => setRankedTiers((current) => relabelBoundaryHints(current.slice(0, -1)))}
          >
            − Remove lowest tier
          </button>
        </div>
        <p className="method-note">Removing a tier moves cards assigned to it into “Unplaced” when you save.</p>
      </fieldset>
      <label>
        <span>Session notes (included in JSON)</span>
        <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button">Save setup</button>
      </div>
    </form>
  );
}

function MapInspector({
  study,
  selectedNode,
  selectedEdge,
  onClear,
  onMoveNode,
  onStartLink,
  onEditCard,
  onDeleteCard,
  onEditEdge,
  onDeleteEdge,
  onSelectEdge,
}) {
  if (selectedNode) {
    const outgoing = study.edges.filter((edge) => edge.source === selectedNode.id);
    const incoming = study.edges.filter((edge) => edge.target === selectedNode.id);
    const nodeTitle = (id) => study.nodes.find((node) => node.id === id)?.title || id;
    return (
      <aside className="inspector-panel">
        <div className="inspector-heading">
          <div>
            <span className="eyebrow">{selectedNode.origin === 'starter' ? 'Default card' : 'Participant-added card'}</span>
            <h2>{selectedNode.title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClear} aria-label="Clear selection">×</button>
        </div>
        <p>{selectedNode.description || 'No working definition supplied.'}</p>
        <label>
          <span>Hierarchy tier</span>
          <select value={selectedNode.tierId} onChange={(event) => onMoveNode(selectedNode.id, event.target.value)}>
            {study.tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
          </select>
        </label>
        <div className="button-stack">
          <button type="button" className="primary-button" onClick={() => onStartLink(selectedNode.id)}>
            Start directed link from this card
          </button>
          {selectedNode.origin === 'participant' ? (
            <>
              <button type="button" className="secondary-button" onClick={() => onEditCard(selectedNode)}>Edit card</button>
              <button type="button" className="ghost-button danger-text" onClick={() => onDeleteCard(selectedNode)}>Delete card</button>
            </>
          ) : null}
        </div>
        <section className="connection-summary">
          <h3>Outgoing ({outgoing.length})</h3>
          {outgoing.length ? (
            <ul className="edge-mini-list">
              {outgoing.map((edge) => (
                <li key={edge.id}>
                  <button type="button" onClick={() => onSelectEdge(edge.id)}>
                    → {nodeTitle(edge.target)} <span>{edge.strength}/5</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">None.</p>}
          <h3>Incoming ({incoming.length})</h3>
          {incoming.length ? (
            <ul className="edge-mini-list">
              {incoming.map((edge) => (
                <li key={edge.id}>
                  <button type="button" onClick={() => onSelectEdge(edge.id)}>
                    ← {nodeTitle(edge.source)} <span>{edge.strength}/5</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">None.</p>}
        </section>
      </aside>
    );
  }

  if (selectedEdge) {
    const source = study.nodes.find((node) => node.id === selectedEdge.source);
    const target = study.nodes.find((node) => node.id === selectedEdge.target);
    return (
      <aside className="inspector-panel">
        <div className="inspector-heading">
          <div>
            <span className="eyebrow">Directed connection</span>
            <h2>{source?.title} → {target?.title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClear} aria-label="Clear selection">×</button>
        </div>
        <dl className="metric-list">
          <div><dt>Strength</dt><dd>{selectedEdge.strength}/5</dd></div>
          <div><dt>Confidence</dt><dd>{selectedEdge.confidence}/5</dd></div>
          {selectedEdge.legacyEffect ? <div><dt>Legacy effect (imported)</dt><dd>{selectedEdge.legacyEffect}</dd></div> : null}
        </dl>
        <h3>{APP_CONFIG.connection.contextLabel}</h3>
        <p>{selectedEdge.context || <span className="muted">No context supplied.</span>}</p>
        <div className="button-stack">
          <button type="button" className="secondary-button" onClick={() => onEditEdge(selectedEdge)}>Edit connection</button>
          <button type="button" className="ghost-button danger-text" onClick={() => onDeleteEdge(selectedEdge)}>Delete connection</button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="inspector-panel empty-inspector">
      <span className="eyebrow">Map inspector</span>
      <h2>Select a card or arrow</h2>
      <p>Drag cards between tiers. Select a card to inspect its definition, change its tier or begin a directed link.</p>
      <ol className="instruction-list">
        <li>Place all cards in the hierarchy.</li>
        <li>Create one directed arrow at a time; add the reverse separately for a bidirectional relationship.</li>
        <li>Rate strength and confidence, then record free-text context.</li>
        <li>Export the JSON file at the end.</li>
      </ol>
    </aside>
  );
}

export default function App() {
  const importInputRef = useRef(null);
  const [view, setView] = useState('map');
  const [theme, setTheme] = useState(initialTheme);
  const [study, setStudy] = useState(loadSavedStudy);
  const [lastSaved, setLastSaved] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      globalThis.localStorage?.setItem(THEME_KEY, theme);
    } catch {
      // The theme still applies for this session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    if (!focusMode) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') setFocusMode(false);
    };
    document.body.classList.add('focus-active');
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.classList.remove('focus-active');
      document.removeEventListener('keydown', handleKey);
    };
  }, [focusMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveStudy(study);
      setLastSaved(new Date());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [study]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function commit(updater) {
    setStudy((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...next,
        study: {
          ...next.study,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  const selectedNode = study.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedEdge = study.edges.find((edge) => edge.id === selectedEdgeId) || null;
  const unplacedCount = study.nodes.filter((node) => node.tierId === 'unplaced').length;
  const customCount = study.nodes.filter((node) => node.origin === 'participant').length;
  const reciprocalPairs = useMemo(() => countReciprocalPairs(study.edges), [study.edges]);

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function openEdgeModal(sourceId, targetId, existing = null) {
    const sourceNode = study.nodes.find((node) => node.id === sourceId);
    const targetNode = study.nodes.find((node) => node.id === targetId);
    if (!sourceNode || !targetNode || sourceId === targetId) return;
    setModal({ type: 'edge', sourceNode, targetNode, existing });
  }

  function handleNodeActivate(id) {
    if (linkMode) {
      if (!linkSourceId) {
        setLinkSourceId(id);
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
        return;
      }
      if (linkSourceId === id) {
        setLinkSourceId(null);
        return;
      }
      const existing = study.edges.find((edge) => edge.source === linkSourceId && edge.target === id) || null;
      openEdgeModal(linkSourceId, id, existing);
      return;
    }
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }

  function saveEdge(sourceNode, targetNode, values, existing) {
    const now = new Date().toISOString();
    commit((current) => {
      const duplicate = current.edges.find(
        (edge) => edge.source === sourceNode.id && edge.target === targetNode.id,
      );
      const edgeId = existing?.id || duplicate?.id || createId('edge');
      const createdAt = existing?.createdAt || duplicate?.createdAt || now;
      const nextEdge = {
        id: edgeId,
        source: sourceNode.id,
        target: targetNode.id,
        ...values,
        createdAt,
        updatedAt: now,
      };
      return {
        ...current,
        edges: duplicate || existing
          ? current.edges.map((edge) => (edge.id === edgeId ? nextEdge : edge))
          : [...current.edges, nextEdge],
      };
    });
    setModal(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(existing?.id || null);
    setLinkSourceId(null);
    setLinkMode(false);
    setToast(existing ? 'Connection updated.' : 'Connection added.');
  }

  function moveNode(id, position, tierId) {
    commit((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === id ? { ...node, position, tierId, updatedAt: new Date().toISOString() } : node,
      ),
    }));
  }

  function moveNodeBySelect(id, tierId) {
    commit((current) => {
      const position = nextPosition(current, tierId, id);
      return {
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === id ? { ...node, tierId, position, updatedAt: new Date().toISOString() } : node,
        ),
      };
    });
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const parsed = normaliseStudy(JSON.parse(await file.text()));
      if (!window.confirm('Replace the current map with the selected JSON file? The current autosave will be overwritten.')) return;
      setStudy(parsed);
      clearSelection();
      setLinkMode(false);
      setLinkSourceId(null);
      setToast('Map imported.');
    } catch (error) {
      window.alert(`Could not import file: ${error.message}`);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  function applySetup(values) {
    commit((current) => {
      const unplaced = current.tiers.find((tier) => tier.kind === 'unplaced') || {
        id: 'unplaced',
        label: APP_CONFIG.app.unplacedLabel,
        kind: 'unplaced',
      };
      const rankedTiers = values.rankedTiers.map((tier, index) => ({
        ...tier,
        kind: 'ranked',
        order: index,
        label: tier.label.trim() || `Tier ${index + 1}`,
      }));
      const tiers = [{ ...unplaced, id: 'unplaced', label: unplaced.label || APP_CONFIG.app.unplacedLabel, kind: 'unplaced', order: -1 }, ...rankedTiers];
      const validTierIds = new Set(tiers.map((tier) => tier.id));
      const nodes = current.nodes.map((node) => ({
        ...node,
        tierId: validTierIds.has(node.tierId) ? node.tierId : 'unplaced',
      }));
      return {
        ...current,
        study: { ...current.study, ...values.study },
        tiers,
        nodes: arrangeNodes(nodes, tiers),
      };
    });
    setModal(null);
    setToast('Study setup saved.');
  }

  const mapPage = (
    <main className={`map-page ${focusMode ? 'is-focus-mode' : ''}`}>
      <section className="toolbar panel-card" aria-label="Map controls">
        <div className="button-row toolbar-primary">
          <button type="button" className="secondary-button" onClick={() => setModal({ type: 'setup' })}>Study setup</button>
          <button type="button" className="primary-button" onClick={() => setModal({ type: 'add-card' })}>+ Add card</button>
          <button
            type="button"
            className={linkMode ? 'active-button' : 'secondary-button'}
            onClick={() => {
              setLinkMode((current) => !current);
              setLinkSourceId(null);
              clearSelection();
            }}
          >
            {linkMode ? 'Cancel linking' : 'Connect cards'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => commit((current) => ({ ...current, nodes: arrangeNodes(current.nodes, current.tiers) }))}
          >
            Auto-arrange
          </button>
          <button type="button" className="secondary-button" onClick={() => setFocusMode(true)}>
            ⛶ Focus workspace
          </button>
        </div>
        <div className="button-row toolbar-data">
          <button type="button" className="ghost-button" onClick={() => importInputRef.current?.click()}>Import JSON</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => importFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="primary-button export-button"
            onClick={() => {
              downloadStudy(study);
              setToast('JSON exported.');
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="ghost-button danger-text"
            onClick={() => {
              if (!window.confirm('Reset the map to the default cards? This replaces the current autosave.')) return;
              setStudy(makeDefaultStudy());
              clearSelection();
              setLinkMode(false);
              setLinkSourceId(null);
              setToast('Map reset.');
            }}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="prompt-card panel-card">
        <div>
          <span className="eyebrow">Hierarchy instruction</span>
          <p>{study.study.hierarchyPrompt}</p>
        </div>
        <div className="compact-stats" aria-label="Map summary">
          <span><strong>{study.nodes.length}</strong> cards</span>
          <span><strong>{customCount}</strong> added</span>
          <span><strong>{study.edges.length}</strong> arrows</span>
          <span><strong>{reciprocalPairs}</strong> bidirectional pairs</span>
          <span className={unplacedCount ? 'warning-stat' : 'complete-stat'}><strong>{unplacedCount}</strong> unplaced</span>
        </div>
      </section>

      {linkMode ? (
        <section className="link-banner" role="status">
          {linkSourceId ? (
            <>
              Source selected: <strong>{study.nodes.find((node) => node.id === linkSourceId)?.title}</strong>. Select the target card.
              <button type="button" onClick={() => setLinkSourceId(null)}>Choose another source</button>
            </>
          ) : (
            <>Select the source card for a directed connection.</>
          )}
        </section>
      ) : null}

      <section className={`map-layout ${focusMode ? 'focus-workspace' : ''}`}>
        <div className="board-panel">
          <div className="board-status-bar">
            <div>
              Participant: <strong>{study.study.participantId || 'not set'}</strong>
              {study.study.participantGroup ? ` · ${study.study.participantGroup}` : ''}
            </div>
            <div className="board-status-actions">
              <span>Drag cards between bands; horizontal position is not treated as a rank.</span>
              {focusMode ? (
                <button type="button" className="focus-exit-button" onClick={() => setFocusMode(false)}>
                  Exit focus <kbd>Esc</kbd>
                </button>
              ) : null}
            </div>
          </div>
          <HierarchyBoard
            tiers={study.tiers}
            nodes={study.nodes}
            edges={study.edges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            linkMode={linkMode}
            linkSourceId={linkSourceId}
            onNodeActivate={handleNodeActivate}
            onNodeInspect={(id) => {
              setSelectedNodeId(id);
              setSelectedEdgeId(null);
            }}
            onNodeMove={moveNode}
            onEdgeSelect={(id) => {
              setSelectedEdgeId(id);
              setSelectedNodeId(null);
            }}
            onPaneClick={() => {
              if (!linkMode) clearSelection();
            }}
          />
        </div>
        <MapInspector
          study={study}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onClear={clearSelection}
          onMoveNode={moveNodeBySelect}
          onStartLink={(id) => {
            setLinkMode(true);
            setLinkSourceId(id);
            setSelectedNodeId(id);
            setSelectedEdgeId(null);
          }}
          onEditCard={(node) => setModal({ type: 'edit-card', node })}
          onDeleteCard={(node) => {
            if (!window.confirm(`Delete “${node.title}” and all of its connections?`)) return;
            commit((current) => ({
              ...current,
              nodes: current.nodes.filter((candidate) => candidate.id !== node.id),
              edges: current.edges.filter((edge) => edge.source !== node.id && edge.target !== node.id),
            }));
            clearSelection();
            setToast('Card deleted.');
          }}
          onEditEdge={(edge) => {
            const sourceNode = study.nodes.find((node) => node.id === edge.source);
            const targetNode = study.nodes.find((node) => node.id === edge.target);
            setModal({ type: 'edge', sourceNode, targetNode, existing: edge });
          }}
          onDeleteEdge={(edge) => {
            if (!window.confirm('Delete this directed connection?')) return;
            commit((current) => ({ ...current, edges: current.edges.filter((candidate) => candidate.id !== edge.id) }));
            clearSelection();
            setToast('Connection deleted.');
          }}
          onSelectEdge={(id) => {
            setSelectedEdgeId(id);
            setSelectedNodeId(null);
          }}
        />
      </section>

      <footer className="source-footer">
        Starter ontology: {SOURCE_FRAMEWORK.authors} ({SOURCE_FRAMEWORK.year}), <em>{SOURCE_FRAMEWORK.title}</em>, DOI{' '}
        <a href={SOURCE_FRAMEWORK.url} target="_blank" rel="noreferrer">{SOURCE_FRAMEWORK.doi}</a>. Definitions in this tool are concise paraphrases.
      </footer>
    </main>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">IH</div>
          <div>
            <h1>{APP_NAME}</h1>
          </div>
        </div>
        <nav className="view-tabs" aria-label="Application modes">
          <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Individual map</button>
          <button type="button" className={view === 'aggregate' ? 'active' : ''} onClick={() => setView('aggregate')}>Aggregate files</button>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="theme-button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <div className="save-status" title={`Application version ${APP_VERSION}`}>
            <span className="save-dot" /> Autosaved locally {lastSaved ? `at ${formatTime(lastSaved)}` : ''}
          </div>
        </div>
      </header>

      {view === 'map' ? mapPage : <AggregateView />}

      <Modal
        open={modal?.type === 'add-card'}
        title="Add a participant-proposed card"
        onClose={() => setModal(null)}
      >
        <CardForm
          existingTitles={study.nodes.map((node) => node.title)}
          onCancel={() => setModal(null)}
          onSubmit={(values) => {
            const now = new Date().toISOString();
            commit((current) => {
              const node = {
                id: createId('custom'),
                sourceKey: null,
                ...values,
                origin: 'participant',
                sourceFrameworkId: null,
                tierId: 'unplaced',
                order: current.nodes.filter((candidate) => candidate.tierId === 'unplaced').length,
                position: nextPosition(current, 'unplaced'),
                createdAt: now,
                updatedAt: now,
              };
              return { ...current, nodes: [...current.nodes, node] };
            });
            setModal(null);
            setToast('Card added to Unplaced.');
          }}
        />
      </Modal>

      <Modal
        open={modal?.type === 'edit-card'}
        title="Edit participant-added card"
        onClose={() => setModal(null)}
      >
        {modal?.node ? (
          <CardForm
            initial={modal.node}
            existingTitles={study.nodes.filter((node) => node.id !== modal.node.id).map((node) => node.title)}
            onCancel={() => setModal(null)}
            onSubmit={(values) => {
              commit((current) => ({
                ...current,
                nodes: current.nodes.map((node) =>
                  node.id === modal.node.id ? { ...node, ...values, updatedAt: new Date().toISOString() } : node,
                ),
              }));
              setModal(null);
              setToast('Card updated.');
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={modal?.type === 'edge'}
        title={modal?.existing ? 'Edit connection' : 'Add connection'}
        onClose={() => setModal(null)}
      >
        {modal?.sourceNode && modal?.targetNode ? (
          <EdgeForm
            sourceNode={modal.sourceNode}
            targetNode={modal.targetNode}
            initial={modal.existing}
            onCancel={() => setModal(null)}
            onSubmit={(values) => saveEdge(modal.sourceNode, modal.targetNode, values, modal.existing)}
          />
        ) : null}
      </Modal>

      <Modal
        open={modal?.type === 'setup'}
        title="Study and hierarchy setup"
        size="large"
        onClose={() => setModal(null)}
      >
        {modal?.type === 'setup' ? <SetupForm study={study} onSubmit={applySetup} onCancel={() => setModal(null)} /> : null}
      </Modal>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
