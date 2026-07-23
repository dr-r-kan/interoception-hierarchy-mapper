import {
  APP_VERSION,
  CANVAS_WIDTH,
  DEFAULT_HIERARCHY_PROMPT,
  NODE_HEIGHT,
  NODE_WIDTH,
  SCHEMA_NAME,
  SCHEMA_VERSION,
  SOURCE_FRAMEWORK,
  STARTER_CARDS,
  STORAGE_KEY,
  TIER_HEIGHT,
  TIER_LABEL_WIDTH,
} from './constants.js';

export function createId(prefix = 'id') {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeDefaultTiers(count = 5) {
  const ranked = Array.from({ length: count }, (_, index) => ({
    id: `tier-${index + 1}`,
    label: `Tier ${index + 1}${index === 0 ? ' (top)' : index === count - 1 ? ' (bottom)' : ''}`,
    kind: 'ranked',
    order: index,
  }));
  return [
    {
      id: 'unplaced',
      label: 'Unplaced card tray',
      kind: 'unplaced',
      order: -1,
    },
    ...ranked,
  ];
}

export function arrangeNodes(nodes, tiers, canvasWidth = CANVAS_WIDTH) {
  const left = TIER_LABEL_WIDTH + 30;
  const rightPadding = 28;
  const xGap = 16;
  const yGap = 16;
  const available = canvasWidth - left - rightPadding;
  const visibleColumns = Math.max(1, Math.min(4, Math.floor((available + xGap) / (NODE_WIDTH + xGap))));

  const orderByTier = new Map(tiers.map((tier, index) => [tier.id, index]));
  const grouped = new Map(tiers.map((tier) => [tier.id, []]));

  for (const node of nodes) {
    const tierId = grouped.has(node.tierId) ? node.tierId : 'unplaced';
    grouped.get(tierId).push(node);
  }

  const arranged = [];
  for (const tier of tiers) {
    const tierIndex = orderByTier.get(tier.id);
    const tierNodes = grouped.get(tier.id) ?? [];
    tierNodes
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))
      .forEach((node, index) => {
        const baseCapacity = visibleColumns * 2;
        const col = index < baseCapacity
          ? index % visibleColumns
          : visibleColumns + Math.floor((index - baseCapacity) / 2);
        const row = index < baseCapacity
          ? Math.floor(index / visibleColumns)
          : (index - baseCapacity) % 2;
        const proposedY = tierIndex * TIER_HEIGHT + 16 + row * (NODE_HEIGHT + yGap);
        const maxY = (tierIndex + 1) * TIER_HEIGHT - NODE_HEIGHT - 12;
        arranged.push({
          ...node,
          tierId: tier.id,
          order: index,
          position: {
            x: left + col * (NODE_WIDTH + xGap),
            y: Math.min(proposedY, maxY),
          },
        });
      });
  }
  return arranged;
}

export function makeDefaultStudy() {
  const tiers = makeDefaultTiers(5);
  const now = new Date().toISOString();
  const nodes = STARTER_CARDS.map((card, index) => ({
    ...card,
    origin: 'starter',
    sourceFrameworkId: SOURCE_FRAMEWORK.id,
    tierId: 'unplaced',
    order: index,
    position: { x: 0, y: 0 },
    createdAt: now,
    updatedAt: now,
  }));

  return {
    schema: SCHEMA_NAME,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    study: {
      title: 'Hierarchical model of interoception',
      participantId: '',
      participantGroup: '',
      hierarchyPrompt: DEFAULT_HIERARCHY_PROMPT,
      notes: '',
      createdAt: now,
      updatedAt: now,
    },
    sourceFramework: SOURCE_FRAMEWORK,
    tiers,
    nodes: arrangeNodes(nodes, tiers),
    edges: [],
  };
}

function asFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseTier(raw, index, rankedCount) {
  const kind = raw?.kind === 'unplaced' || raw?.id === 'unplaced' ? 'unplaced' : 'ranked';
  return {
    id: String(raw?.id || (kind === 'unplaced' ? 'unplaced' : `tier-${index + 1}`)),
    label: String(raw?.label || (kind === 'unplaced' ? 'Unplaced' : `Tier ${index + 1}`)),
    kind,
    order: kind === 'unplaced' ? -1 : index,
  };
}

export function normaliseStudy(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('The selected file does not contain a study object.');
  }
  if (raw.schema && raw.schema !== SCHEMA_NAME) {
    throw new Error(`Unsupported schema: ${raw.schema}`);
  }

  const rawTiers = Array.isArray(raw.tiers) ? raw.tiers : [];
  const rankedRaw = rawTiers.filter((tier) => tier?.kind !== 'unplaced' && tier?.id !== 'unplaced');
  const rankedCount = Math.max(1, rankedRaw.length || 5);
  const ranked = (rankedRaw.length ? rankedRaw : makeDefaultTiers(5).filter((t) => t.kind === 'ranked'))
    .map((tier, index) => normaliseTier(tier, index, rankedCount));
  const unplacedRaw = rawTiers.find((tier) => tier?.kind === 'unplaced' || tier?.id === 'unplaced');
  const tiers = [
    normaliseTier(unplacedRaw || { id: 'unplaced', label: 'Unplaced card tray', kind: 'unplaced' }, ranked.length, ranked.length),
    ...ranked,
  ];
  const tierIds = new Set(tiers.map((tier) => tier.id));

  if (!Array.isArray(raw.nodes)) {
    throw new Error('The selected file has no node list.');
  }

  const now = new Date().toISOString();
  const seenNodeIds = new Set();
  const nodes = raw.nodes.map((node, index) => {
    let id = String(node?.id || createId('node'));
    if (seenNodeIds.has(id)) id = createId('node');
    seenNodeIds.add(id);
    const starter = STARTER_CARDS.find(
      (card) => card.id === id || card.sourceKey === node?.sourceKey || card.sourceKey === node?.id,
    );
    const origin = node?.origin === 'starter' || starter ? 'starter' : 'participant';
    const tierId = tierIds.has(node?.tierId) ? node.tierId : 'unplaced';
    const position = node?.position && Number.isFinite(Number(node.position.x)) && Number.isFinite(Number(node.position.y))
      ? { x: Number(node.position.x), y: Number(node.position.y) }
      : { x: 0, y: 0 };

    return {
      id: starter?.id || id,
      sourceKey: starter?.sourceKey || (origin === 'starter' ? String(node?.sourceKey || id) : null),
      title: String(node?.title || starter?.title || `Untitled card ${index + 1}`),
      description: String(node?.description || starter?.description || ''),
      origin,
      sourceFrameworkId: origin === 'starter' ? SOURCE_FRAMEWORK.id : null,
      tierId,
      order: asFiniteNumber(node?.order, index),
      position,
      createdAt: String(node?.createdAt || now),
      updatedAt: String(node?.updatedAt || now),
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenEdgeKeys = new Set();
  const edges = (Array.isArray(raw.edges) ? raw.edges : [])
    .filter((edge) => nodeIds.has(edge?.source) && nodeIds.has(edge?.target) && edge.source !== edge.target)
    .map((edge) => {
      const key = `${edge.source}→${edge.target}`;
      if (seenEdgeKeys.has(key)) return null;
      seenEdgeKeys.add(key);
      const strength = Math.min(5, Math.max(1, asFiniteNumber(edge?.strength, 3)));
      const confidence = Math.min(5, Math.max(1, asFiniteNumber(edge?.confidence, 3)));
      return {
        id: String(edge?.id || `edge-${key}`),
        source: String(edge.source),
        target: String(edge.target),
        strength,
        confidence,
        effect: ['positive', 'negative', 'context-dependent', 'unspecified'].includes(edge?.effect)
          ? edge.effect
          : 'unspecified',
        rationale: String(edge?.rationale || ''),
        createdAt: String(edge?.createdAt || now),
        updatedAt: String(edge?.updatedAt || now),
      };
    })
    .filter(Boolean);

  const allPositionsZero = nodes.every((node) => node.position.x === 0 && node.position.y === 0);
  const normalisedNodes = allPositionsZero ? arrangeNodes(nodes, tiers) : nodes;

  return {
    schema: SCHEMA_NAME,
    schemaVersion: SCHEMA_VERSION,
    appVersion: String(raw.appVersion || APP_VERSION),
    study: {
      title: String(raw.study?.title || 'Hierarchical model of interoception'),
      participantId: String(raw.study?.participantId || ''),
      participantGroup: String(raw.study?.participantGroup || ''),
      hierarchyPrompt: String(raw.study?.hierarchyPrompt || DEFAULT_HIERARCHY_PROMPT),
      notes: String(raw.study?.notes || ''),
      createdAt: String(raw.study?.createdAt || now),
      updatedAt: String(raw.study?.updatedAt || now),
    },
    sourceFramework: raw.sourceFramework || SOURCE_FRAMEWORK,
    tiers,
    nodes: normalisedNodes,
    edges,
  };
}

export function loadSavedStudy() {
  try {
    const text = globalThis.localStorage?.getItem(STORAGE_KEY);
    return text ? normaliseStudy(JSON.parse(text)) : makeDefaultStudy();
  } catch (error) {
    console.warn('Could not restore autosaved study:', error);
    return makeDefaultStudy();
  }
}

export function saveStudy(study) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(study));
}

export function exportPayload(study) {
  const now = new Date().toISOString();
  return {
    ...study,
    schema: SCHEMA_NAME,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: now,
    study: {
      ...study.study,
      updatedAt: now,
    },
    validation: {
      unplacedNodeCount: study.nodes.filter((node) => node.tierId === 'unplaced').length,
      customNodeCount: study.nodes.filter((node) => node.origin === 'participant').length,
      edgeCount: study.edges.length,
      edgeRationalesMissing: study.edges.filter((edge) => !edge.rationale.trim()).length,
    },
  };
}

export function safeFilename(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function downloadText(text, filename, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadStudy(study) {
  const payload = exportPayload(study);
  const participant = safeFilename(study.study.participantId) || 'anonymous';
  const date = new Date().toISOString().slice(0, 10);
  downloadText(
    `${JSON.stringify(payload, null, 2)}\n`,
    `interoception-map_${participant}_${date}.json`,
  );
}

export function addRankedTier(study) {
  const ranked = study.tiers.filter((tier) => tier.kind === 'ranked');
  const unplaced = study.tiers.find((tier) => tier.kind === 'unplaced') || {
    id: 'unplaced',
    label: 'Unplaced',
    kind: 'unplaced',
  };
  const id = createId('tier');
  const nextRanked = [
    ...ranked,
    { id, label: `Tier ${ranked.length + 1} (bottom)`, kind: 'ranked', order: ranked.length },
  ].map((tier, index, list) => ({
    ...tier,
    order: index,
    label: tier.label
      .replace(/ \(top\)| \(bottom\)/g, '')
      .concat(index === 0 ? ' (top)' : index === list.length - 1 ? ' (bottom)' : ''),
  }));
  const tiers = [{ ...unplaced, order: -1 }, ...nextRanked];
  return {
    ...study,
    tiers,
    nodes: arrangeNodes(study.nodes, tiers),
  };
}

export function removeLowestRankedTier(study) {
  const ranked = study.tiers.filter((tier) => tier.kind === 'ranked');
  if (ranked.length <= 2) return study;
  const removed = ranked.at(-1);
  const nextRanked = ranked.slice(0, -1).map((tier, index, list) => ({
    ...tier,
    order: index,
    label: tier.label
      .replace(/ \(top\)| \(bottom\)/g, '')
      .concat(index === 0 ? ' (top)' : index === list.length - 1 ? ' (bottom)' : ''),
  }));
  const unplaced = study.tiers.find((tier) => tier.kind === 'unplaced') || {
    id: 'unplaced',
    label: 'Unplaced',
    kind: 'unplaced',
  };
  const tiers = [{ ...unplaced, order: -1 }, ...nextRanked];
  const nodes = study.nodes.map((node) =>
    node.tierId === removed.id ? { ...node, tierId: 'unplaced' } : node,
  );
  return {
    ...study,
    tiers,
    nodes: arrangeNodes(nodes, tiers),
  };
}
