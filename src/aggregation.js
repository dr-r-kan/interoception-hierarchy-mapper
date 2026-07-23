import { STARTER_CARDS } from './constants.js';
import { arrangeNodes, makeDefaultTiers } from './state.js';

export function normaliseLabel(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function canonicalNodeKey(node) {
  const starter = STARTER_CARDS.find(
    (card) =>
      card.id === node?.id ||
      card.sourceKey === node?.sourceKey ||
      card.sourceKey === node?.id,
  );
  if (starter || node?.origin === 'starter') {
    return starter?.sourceKey || String(node?.sourceKey || node?.id);
  }
  const label = normaliseLabel(node?.title);
  return label ? `custom:${label}` : `custom:${String(node?.id || 'unnamed')}`;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values) {
  if (values.length < 2) return null;
  const centre = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - centre) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function mode(values) {
  if (!values.length) return null;
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
}

function participantLabel(study, index) {
  return study.study?.participantId?.trim() || `Participant ${index + 1}`;
}

export function aggregateStudies(studies) {
  if (!Array.isArray(studies) || studies.length === 0) {
    return {
      participantCount: 0,
      nodes: [],
      edges: [],
      duplicateParticipantIds: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const nodeAccumulators = new Map();
  const edgeAccumulators = new Map();
  const studyNodePresence = [];
  const participantIdCounts = new Map();

  studies.forEach((study, studyIndex) => {
    const participant = participantLabel(study, studyIndex);
    const explicitId = study.study?.participantId?.trim();
    if (explicitId) participantIdCounts.set(explicitId, (participantIdCounts.get(explicitId) || 0) + 1);

    const rankedTiers = (study.tiers || [])
      .filter((tier) => tier.kind !== 'unplaced' && tier.id !== 'unplaced')
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const tierIndexById = new Map(rankedTiers.map((tier, index) => [tier.id, index]));
    const denominator = Math.max(1, rankedTiers.length - 1);

    const idToCanonical = new Map();
    const present = new Set();

    for (const node of study.nodes || []) {
      const key = canonicalNodeKey(node);
      idToCanonical.set(node.id, key);
      present.add(key);
      const starter = node.origin === 'starter' || !key.startsWith('custom:');
      const existing = nodeAccumulators.get(key) || {
        key,
        origin: starter ? 'starter' : 'participant',
        sourceKey: starter ? key : null,
        titles: [],
        descriptions: [],
        participantIndexes: new Set(),
        tierScores: [],
        tierParticipants: [],
      };
      existing.titles.push(String(node.title || key));
      if (node.description?.trim()) existing.descriptions.push(String(node.description));
      existing.participantIndexes.add(studyIndex);
      if (tierIndexById.has(node.tierId)) {
        const score = rankedTiers.length === 1 ? 0.5 : tierIndexById.get(node.tierId) / denominator;
        existing.tierScores.push(score);
        existing.tierParticipants.push({ participant, score });
      }
      nodeAccumulators.set(key, existing);
    }
    studyNodePresence.push(present);

    const seenEdgesForParticipant = new Set();
    for (const edge of study.edges || []) {
      const sourceKey = idToCanonical.get(edge.source);
      const targetKey = idToCanonical.get(edge.target);
      if (!sourceKey || !targetKey || sourceKey === targetKey) continue;
      const edgeKey = `${sourceKey}→${targetKey}`;
      if (seenEdgesForParticipant.has(edgeKey)) continue;
      seenEdgesForParticipant.add(edgeKey);
      const existing = edgeAccumulators.get(edgeKey) || {
        key: edgeKey,
        sourceKey,
        targetKey,
        participantIndexes: new Set(),
        strengths: [],
        confidences: [],
        effects: [],
        rationales: [],
      };
      existing.participantIndexes.add(studyIndex);
      existing.strengths.push(Number(edge.strength));
      existing.confidences.push(Number(edge.confidence));
      existing.effects.push(edge.effect || 'unspecified');
      if (edge.rationale?.trim()) {
        existing.rationales.push({
          participant,
          text: String(edge.rationale).trim(),
        });
      }
      edgeAccumulators.set(edgeKey, existing);
    }
  });

  const nodes = [...nodeAccumulators.values()]
    .map((record) => ({
      key: record.key,
      origin: record.origin,
      sourceKey: record.sourceKey,
      title: mode(record.titles) || record.key,
      titleVariants: [...new Set(record.titles)].sort(),
      description: mode(record.descriptions) || '',
      nominationCount: record.participantIndexes.size,
      nominationPrevalence: record.participantIndexes.size / studies.length,
      tierRatingCount: record.tierScores.length,
      meanRelativeTier: mean(record.tierScores),
      sdRelativeTier: sampleSd(record.tierScores),
      tierRatings: record.tierParticipants,
    }))
    .sort((a, b) => {
      if (a.origin !== b.origin) return a.origin === 'starter' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

  const edges = [...edgeAccumulators.values()]
    .map((record) => {
      const endorsementCount = record.participantIndexes.size;
      const eligibleCount = studyNodePresence.filter(
        (present) => present.has(record.sourceKey) && present.has(record.targetKey),
      ).length;
      const meanStrength = mean(record.strengths);
      const prevalenceAll = endorsementCount / studies.length;
      const prevalenceEligible = eligibleCount ? endorsementCount / eligibleCount : null;
      const effectCounts = Object.fromEntries(
        [...new Set(record.effects)].map((effect) => [
          effect,
          record.effects.filter((candidate) => candidate === effect).length,
        ]),
      );
      return {
        key: record.key,
        sourceKey: record.sourceKey,
        targetKey: record.targetKey,
        endorsementCount,
        eligibleCount,
        prevalenceAll,
        prevalenceEligible,
        meanStrength,
        sdStrength: sampleSd(record.strengths),
        meanConfidence: mean(record.confidences),
        sdConfidence: sampleSd(record.confidences),
        prevalenceWeightedStrength: meanStrength * prevalenceAll,
        modalEffect: mode(record.effects) || 'unspecified',
        effectCounts,
        rationales: record.rationales,
      };
    })
    .sort((a, b) => b.prevalenceWeightedStrength - a.prevalenceWeightedStrength);

  const duplicateParticipantIds = [...participantIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([participantId, count]) => ({ participantId, count }));

  return {
    participantCount: studies.length,
    nodes,
    edges,
    duplicateParticipantIds,
    generatedAt: new Date().toISOString(),
    aggregationNotes: {
      hierarchy:
        'Ranked tiers are converted within each participant to a relative score from 0 (top) to 1 (bottom) before averaging.',
      fixedNodes: 'Starter cards are matched by stable source identifiers.',
      customNodes:
        'Participant-added cards are provisionally matched by normalised exact title; semantic reconciliation is not performed.',
      edgePrevalence:
        'prevalenceAll uses all imported maps as denominator; prevalenceEligible uses only maps containing both endpoint cards.',
    },
  };
}

export function buildAggregateMap(
  aggregate,
  {
    includeCustom = true,
    minimumCustomNominations = 1,
    minimumEdgePrevalence = 0,
    tierCount = 5,
  } = {},
) {
  const tiers = makeDefaultTiers(tierCount).map((tier) => ({
    ...tier,
    label:
      tier.kind === 'unplaced'
        ? 'No hierarchy rating'
        : `Aggregate tier ${tier.order + 1}${tier.order === 0 ? ' (top)' : tier.order === tierCount - 1 ? ' (bottom)' : ''}`,
  }));
  const rankedDisplayTiers = tiers.filter((tier) => tier.kind === 'ranked');
  const visibleRecords = aggregate.nodes.filter(
    (node) => node.origin === 'starter' || (includeCustom && node.nominationCount >= minimumCustomNominations),
  );
  const visibleKeys = new Set(visibleRecords.map((node) => node.key));

  const nodes = visibleRecords.map((record, index) => {
    const tierIndex =
      record.meanRelativeTier == null
        ? null
        : Math.max(0, Math.min(tierCount - 1, Math.round(record.meanRelativeTier * (tierCount - 1))));
    return {
      id: `aggregate-node:${record.key}`,
      sourceKey: record.sourceKey,
      title: record.title,
      description: record.description,
      origin: record.origin,
      aggregate: record,
      tierId: tierIndex == null ? 'unplaced' : rankedDisplayTiers[tierIndex].id,
      order: index,
      position: { x: 0, y: 0 },
    };
  });
  const idByKey = new Map(nodes.map((node) => [node.aggregate.key, node.id]));

  const edges = aggregate.edges
    .filter(
      (record) =>
        visibleKeys.has(record.sourceKey) &&
        visibleKeys.has(record.targetKey) &&
        record.prevalenceAll >= minimumEdgePrevalence,
    )
    .map((record) => ({
      id: `aggregate-edge:${record.key}`,
      source: idByKey.get(record.sourceKey),
      target: idByKey.get(record.targetKey),
      strength: record.meanStrength,
      displayWeight: record.prevalenceWeightedStrength,
      confidence: record.meanConfidence,
      effect: record.modalEffect,
      rationale: '',
      label: `${Math.round(record.prevalenceAll * 100)}% · ${record.meanStrength.toFixed(1)}`,
      aggregate: record,
    }));

  return {
    tiers,
    nodes: arrangeNodes(nodes, tiers),
    edges,
  };
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function aggregateNodesCsv(aggregate) {
  const rows = [
    [
      'node_key',
      'title',
      'origin',
      'nomination_count',
      'nomination_prevalence',
      'tier_rating_count',
      'mean_relative_tier',
      'sd_relative_tier',
      'title_variants',
      'description',
    ],
    ...aggregate.nodes.map((node) => [
      node.key,
      node.title,
      node.origin,
      node.nominationCount,
      node.nominationPrevalence,
      node.tierRatingCount,
      node.meanRelativeTier,
      node.sdRelativeTier,
      node.titleVariants.join(' | '),
      node.description,
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function aggregateEdgesCsv(aggregate) {
  const rows = [
    [
      'edge_key',
      'source_key',
      'target_key',
      'endorsement_count',
      'eligible_count',
      'prevalence_all',
      'prevalence_eligible',
      'mean_strength',
      'sd_strength',
      'mean_confidence',
      'sd_confidence',
      'prevalence_weighted_strength',
      'modal_effect',
      'effect_counts_json',
      'rationales_json',
    ],
    ...aggregate.edges.map((edge) => [
      edge.key,
      edge.sourceKey,
      edge.targetKey,
      edge.endorsementCount,
      edge.eligibleCount,
      edge.prevalenceAll,
      edge.prevalenceEligible,
      edge.meanStrength,
      edge.sdStrength,
      edge.meanConfidence,
      edge.sdConfidence,
      edge.prevalenceWeightedStrength,
      edge.modalEffect,
      JSON.stringify(edge.effectCounts),
      JSON.stringify(edge.rationales),
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}
