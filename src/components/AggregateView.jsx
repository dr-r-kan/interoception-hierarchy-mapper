import { useMemo, useRef, useState } from 'react';
import {
  aggregateEdgesCsv,
  aggregateNodesCsv,
  aggregateStudies,
  buildAggregateMap,
} from '../aggregation.js';
import { downloadText, normaliseStudy, safeFilename } from '../state.js';
import HierarchyBoard from './HierarchyBoard.jsx';

function formatNumber(value, digits = 2) {
  return value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
}

function AggregateInspector({ selectedNode, selectedEdge, participantCount, onClear }) {
  if (selectedNode) {
    const record = selectedNode.aggregate;
    return (
      <aside className="inspector-panel">
        <div className="inspector-heading">
          <div>
            <span className="eyebrow">Aggregate card</span>
            <h2>{selectedNode.title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClear} aria-label="Clear selection">
            ×
          </button>
        </div>
        <p>{selectedNode.description || 'No shared definition was supplied.'}</p>
        <dl className="metric-list">
          <div>
            <dt>Maps containing card</dt>
            <dd>
              {record.nominationCount}/{participantCount} ({Math.round(record.nominationPrevalence * 100)}%)
            </dd>
          </div>
          <div>
            <dt>Hierarchy ratings</dt>
            <dd>{record.tierRatingCount}</dd>
          </div>
          <div>
            <dt>Mean relative tier</dt>
            <dd>{formatNumber(record.meanRelativeTier)}</dd>
          </div>
          <div>
            <dt>SD of relative tier</dt>
            <dd>{formatNumber(record.sdRelativeTier)}</dd>
          </div>
        </dl>
        <p className="method-note">
          Relative tier is scaled within each map: 0 is the highest ranked tier and 1 the lowest.
        </p>
        {record.titleVariants.length > 1 ? (
          <details>
            <summary>Matched title variants ({record.titleVariants.length})</summary>
            <ul className="compact-list">
              {record.titleVariants.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </aside>
    );
  }

  if (selectedEdge) {
    const record = selectedEdge.aggregate;
    return (
      <aside className="inspector-panel">
        <div className="inspector-heading">
          <div>
            <span className="eyebrow">Aggregate connection</span>
            <h2>{selectedEdge.label}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClear} aria-label="Clear selection">
            ×
          </button>
        </div>
        <dl className="metric-list">
          <div>
            <dt>Endorsements</dt>
            <dd>
              {record.endorsementCount}/{participantCount} ({Math.round(record.prevalenceAll * 100)}%)
            </dd>
          </div>
          <div>
            <dt>Eligible maps</dt>
            <dd>{record.eligibleCount}</dd>
          </div>
          <div>
            <dt>Conditional prevalence</dt>
            <dd>{record.prevalenceEligible == null ? '—' : `${Math.round(record.prevalenceEligible * 100)}%`}</dd>
          </div>
          <div>
            <dt>Mean strength</dt>
            <dd>
              {formatNumber(record.meanStrength)} {record.sdStrength == null ? '' : `(SD ${formatNumber(record.sdStrength)})`}
            </dd>
          </div>
          <div>
            <dt>Mean confidence</dt>
            <dd>
              {formatNumber(record.meanConfidence)}{' '}
              {record.sdConfidence == null ? '' : `(SD ${formatNumber(record.sdConfidence)})`}
            </dd>
          </div>
          <div>
            <dt>Prevalence-weighted strength</dt>
            <dd>{formatNumber(record.prevalenceWeightedStrength)}</dd>
          </div>
          <div>
            <dt>Reciprocal endorsements</dt>
            <dd>
              {record.reciprocalEndorsementCount}/{participantCount} ({Math.round(record.reciprocalPrevalenceAll * 100)}%)
            </dd>
          </div>
        </dl>
        <details open={record.contexts.length <= 4}>
          <summary>Connection context ({record.contexts.length})</summary>
          {record.contexts.length ? (
            <div className="context-list">
              {record.contexts.map((item, index) => (
                <blockquote key={`${item.participant}-${index}`}>
                  <p>{item.text}</p>
                  <footer>{item.participant}</footer>
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="muted">No context was supplied for this connection.</p>
          )}
        </details>
      </aside>
    );
  }

  return (
    <aside className="inspector-panel empty-inspector">
      <span className="eyebrow">Aggregate inspection</span>
      <h2>Select a card or arrow</h2>
      <p>Card selection shows hierarchy dispersion. Arrow selection shows prevalence, reciprocal endorsement, strength, confidence and pooled context.</p>
    </aside>
  );
}

export default function AggregateView() {
  const fileInputRef = useRef(null);
  const [imports, setImports] = useState([]);
  const [errors, setErrors] = useState([]);
  const [includeCustom, setIncludeCustom] = useState(true);
  const [minimumCustomNominations, setMinimumCustomNominations] = useState(1);
  const [minimumEdgePrevalence, setMinimumEdgePrevalence] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  const studies = useMemo(() => imports.map((item) => item.study), [imports]);
  const aggregate = useMemo(() => aggregateStudies(studies), [studies]);
  const map = useMemo(
    () =>
      buildAggregateMap(aggregate, {
        includeCustom,
        minimumCustomNominations,
        minimumEdgePrevalence,
      }),
    [aggregate, includeCustom, minimumCustomNominations, minimumEdgePrevalence],
  );

  const selectedNode = map.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedEdge = map.edges.find((edge) => edge.id === selectedEdgeId) || null;

  async function addFiles(fileList) {
    const nextImports = [];
    const nextErrors = [];
    for (const file of Array.from(fileList || [])) {
      try {
        const text = await file.text();
        const study = normaliseStudy(JSON.parse(text));
        nextImports.push({ filename: file.name, study });
      } catch (error) {
        nextErrors.push(`${file.name}: ${error.message}`);
      }
    }
    if (nextImports.length) setImports((current) => [...current, ...nextImports]);
    if (nextErrors.length) setErrors((current) => [...current, ...nextErrors]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function downloadAggregateJson() {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `interoception-aggregate_${safeFilename(String(aggregate.participantCount))}-maps_${date}.json`;
    downloadText(`${JSON.stringify(aggregate, null, 2)}\n`, filename);
  }

  if (!imports.length) {
    return (
      <main className="aggregate-empty-page">
        <section
          className="upload-card"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <span className="upload-icon" aria-hidden="true">⇧</span>
          <span className="eyebrow">Organiser mode</span>
          <h1>Aggregate participant JSON files</h1>
          <p>
            Drop exported map files here or select them from disk. Processing remains in this browser; files are not uploaded.
          </p>
          <button type="button" className="primary-button" onClick={() => fileInputRef.current?.click()}>
            Select JSON files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            multiple
            hidden
            onChange={(event) => addFiles(event.target.files)}
          />
          {errors.length ? (
            <div className="error-box" role="alert">
              <strong>Files not imported</strong>
              <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="aggregate-page">
      <section className="aggregate-controls panel-card">
        <div className="control-heading">
          <div>
            <span className="eyebrow">Organiser mode</span>
            <h1>{aggregate.participantCount} maps loaded</h1>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
              Add files
            </button>
            <button
              type="button"
              className="ghost-button danger-text"
              onClick={() => {
                setImports([]);
                setErrors([]);
                clearSelection();
              }}
            >
              Clear
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            multiple
            hidden
            onChange={(event) => addFiles(event.target.files)}
          />
        </div>

        <div className="aggregate-filter-grid">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={includeCustom}
              onChange={(event) => setIncludeCustom(event.target.checked)}
            />
            <span>Include participant-added cards</span>
          </label>
          <label>
            <span>Minimum nominations for an added card</span>
            <input
              type="number"
              min="1"
              max={Math.max(1, aggregate.participantCount)}
              value={minimumCustomNominations}
              disabled={!includeCustom}
              onChange={(event) => setMinimumCustomNominations(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <label>
            <span>Minimum edge prevalence: {Math.round(minimumEdgePrevalence * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minimumEdgePrevalence}
              onChange={(event) => setMinimumEdgePrevalence(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="button-row export-row">
          <button type="button" className="secondary-button" onClick={downloadAggregateJson}>
            Export aggregate JSON
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => downloadText(aggregateNodesCsv(aggregate), 'interoception-aggregate_nodes.csv', 'text/csv')}
          >
            Export nodes CSV
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => downloadText(aggregateEdgesCsv(aggregate), 'interoception-aggregate_edges.csv', 'text/csv')}
          >
            Export edges CSV
          </button>
        </div>

        {aggregate.duplicateParticipantIds.length ? (
          <div className="warning-box" role="status">
            <strong>Duplicate participant codes detected:</strong>{' '}
            {aggregate.duplicateParticipantIds.map((item) => `${item.participantId} × ${item.count}`).join(', ')}.
            Files have not been deduplicated.
          </div>
        ) : null}
        {errors.length ? (
          <details className="error-details">
            <summary>{errors.length} file error(s)</summary>
            <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </details>
        ) : null}
      </section>

      <section className="map-layout aggregate-layout">
        <div className="board-panel">
          <div className="board-status-bar">
            <div>
              <strong>{map.nodes.length}</strong> visible cards · <strong>{map.edges.length}</strong> visible arrows
            </div>
            <div className="legend-inline">
              <span><i className="legend-line thin" /> low weighted strength</span>
              <span><i className="legend-line thick" /> high weighted strength</span>
            </div>
          </div>
          <HierarchyBoard
            tiers={map.tiers}
            nodes={map.nodes}
            edges={map.edges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            readOnly
            onNodeActivate={(id) => {
              setSelectedNodeId(id);
              setSelectedEdgeId(null);
            }}
            onNodeInspect={(id) => {
              setSelectedNodeId(id);
              setSelectedEdgeId(null);
            }}
            onEdgeSelect={(id) => {
              setSelectedEdgeId(id);
              setSelectedNodeId(null);
            }}
            onPaneClick={clearSelection}
          />
        </div>
        <AggregateInspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          participantCount={aggregate.participantCount}
          onClear={clearSelection}
        />
      </section>

      <section className="panel-card methodology-card">
        <h2>Aggregation implemented in this prototype</h2>
        <p>
          Starter cards are matched by stable identifiers. Added cards are matched only when their titles are identical after case,
          punctuation and whitespace normalisation; this is provisional and should be manually reconciled before inferential analysis.
          Tiers are normalised within participant from 0 (top) to 1 (bottom). Arrow width represents prevalence-weighted mean strength;
          the label reports overall prevalence and mean strength among endorsers.
        </p>
      </section>
    </main>
  );
}
