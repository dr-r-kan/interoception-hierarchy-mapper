import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateStudies, buildAggregateMap, canonicalNodeKey, normaliseLabel } from '../src/aggregation.js';
import { CONNECTOR_TYPES, STARTER_CARDS } from '../src/constants.js';
import {
  countReciprocalPairs,
  exportPayload,
  makeDefaultStudy,
  normaliseStudy,
} from '../src/state.js';

function place(study, nodeId, tierId) {
  return {
    ...study,
    nodes: study.nodes.map((node) => (node.id === nodeId ? { ...node, tierId } : node)),
  };
}

test('default study contains the unique config-driven card set', () => {
  const study = makeDefaultStudy();
  assert.equal(study.nodes.length, 9);
  assert.equal(study.nodes.filter((node) => node.origin === 'starter').length, 9);
  assert.equal(study.tiers[0].id, 'unplaced');
  assert.equal(new Set(STARTER_CARDS.map((card) => card.id)).size, STARTER_CARDS.length);
  assert.equal(study.nodes.filter((node) => node.id === 'sg-attribution').length, 1);
  assert.equal(study.nodes.find((node) => node.id === 'interoceptive-appraisal').sourceFrameworkId, null);
  assert.deepEqual(CONNECTOR_TYPES.map((connector) => connector.id), ['unidirectional', 'bidirectional']);
});

test('custom labels are normalised conservatively for provisional matching', () => {
  assert.equal(normaliseLabel('  Interoceptive—Prediction! '), 'interoceptive prediction');
  assert.equal(
    canonicalNodeKey({ id: 'x', origin: 'participant', title: 'Interoceptive Prediction' }),
    'custom:interoceptive prediction',
  );
});

test('aggregation preserves edge direction and calculates prevalence-weighted strength', () => {
  let a = makeDefaultStudy();
  let b = makeDefaultStudy();
  a.study.participantId = 'A';
  b.study.participantId = 'B';
  const source = a.nodes[0].id;
  const target = a.nodes[1].id;
  a = place(a, source, 'tier-1');
  a = place(a, target, 'tier-5');
  b = place(b, source, 'tier-3');
  b = place(b, target, 'tier-5');
  a.edges = [{
    id: 'e1', source, target, strength: 4, confidence: 5, context: 'A',
  }];
  b.edges = [{
    id: 'e2', source, target, strength: 2, confidence: 3, context: 'B',
  }];

  const aggregate = aggregateStudies([a, b]);
  assert.equal(aggregate.edges.length, 1);
  assert.equal(aggregate.edges[0].endorsementCount, 2);
  assert.equal(aggregate.edges[0].prevalenceAll, 1);
  assert.equal(aggregate.edges[0].meanStrength, 3);
  assert.equal(aggregate.edges[0].prevalenceWeightedStrength, 3);
  assert.equal(aggregate.edges[0].sourceKey, source);
  assert.equal(aggregate.edges[0].targetKey, target);

  const sourceNode = aggregate.nodes.find((node) => node.key === source);
  assert.equal(sourceNode.meanRelativeTier, 0.25);
  const display = buildAggregateMap(aggregate);
  const displayedSource = display.nodes.find((node) => node.aggregate.key === source);
  assert.notEqual(displayedSource.tierId, 'unplaced');
});

test('aggregate display can filter participant-added cards by nomination count', () => {
  const a = makeDefaultStudy();
  const b = makeDefaultStudy();
  a.nodes.push({
    id: 'custom-a', title: 'Interoceptive prediction', description: '', origin: 'participant',
    tierId: 'unplaced', position: { x: 0, y: 0 }, order: 9,
  });
  b.nodes.push({
    id: 'custom-b', title: 'Interoceptive Prediction', description: '', origin: 'participant',
    tierId: 'unplaced', position: { x: 0, y: 0 }, order: 9,
  });
  const aggregate = aggregateStudies([a, b]);
  const custom = aggregate.nodes.find((node) => node.key === 'custom:interoceptive prediction');
  assert.equal(custom.nominationCount, 2);
  assert.equal(buildAggregateMap(aggregate, { minimumCustomNominations: 2 }).nodes.length, 10);
  assert.equal(buildAggregateMap(aggregate, { minimumCustomNominations: 3 }).nodes.length, 9);
});

test('legacy v0.1.0 edges import as directed arrows with context and round-trip in v1.1.0', () => {
  const legacy = makeDefaultStudy();
  legacy.appVersion = '0.1.0';
  legacy.schemaVersion = '1.0.0';
  legacy.edges = [{
    id: 'legacy-edge',
    source: legacy.nodes[0].id,
    target: legacy.nodes[1].id,
    strength: 4,
    confidence: 3,
    effect: 'context-dependent',
    rationale: 'Depends on the task.',
  }];

  const imported = normaliseStudy(legacy);
  assert.equal(imported.edges[0].context, 'Depends on the task.');
  assert.equal(imported.edges[0].legacyEffect, 'context-dependent');
  assert.equal(imported.edges[0].effect, undefined);

  const exported = exportPayload(imported);
  assert.equal(exported.schemaVersion, '1.1.0');
  assert.equal(normaliseStudy(exported).edges[0].context, 'Depends on the task.');
});

test('reciprocal arrows remain separate and aggregate as a bidirectional pair', () => {
  const a = makeDefaultStudy();
  const b = makeDefaultStudy();
  const source = a.nodes[0].id;
  const target = a.nodes[1].id;
  a.edges = [
    { id: 'a-forward', source, target, strength: 4, confidence: 4, context: 'Forward' },
    { id: 'a-reverse', source: target, target: source, strength: 2, confidence: 3, context: 'Reverse' },
  ];
  b.edges = [
    { id: 'b-forward', source, target, strength: 3, confidence: 3, context: 'Forward only' },
  ];

  assert.equal(countReciprocalPairs(a.edges), 1);
  const aggregate = aggregateStudies([a, b]);
  assert.equal(aggregate.edges.length, 2);
  const forward = aggregate.edges.find((edge) => edge.sourceKey === source && edge.targetKey === target);
  assert.equal(forward.endorsementCount, 2);
  assert.equal(forward.reciprocalEndorsementCount, 1);
  assert.equal(forward.reciprocalPrevalenceAll, 0.5);
});
