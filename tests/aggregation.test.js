import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateStudies, buildAggregateMap, canonicalNodeKey, normaliseLabel } from '../src/aggregation.js';
import { makeDefaultStudy } from '../src/state.js';

function place(study, nodeId, tierId) {
  return {
    ...study,
    nodes: study.nodes.map((node) => (node.id === nodeId ? { ...node, tierId } : node)),
  };
}

test('default study contains the eight fixed Suksasilp–Garfinkel cards', () => {
  const study = makeDefaultStudy();
  assert.equal(study.nodes.length, 8);
  assert.equal(study.nodes.filter((node) => node.origin === 'starter').length, 8);
  assert.equal(study.tiers[0].id, 'unplaced');
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
    id: 'e1', source, target, strength: 4, confidence: 5, effect: 'positive', rationale: 'A',
  }];
  b.edges = [{
    id: 'e2', source, target, strength: 2, confidence: 3, effect: 'positive', rationale: 'B',
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
  assert.equal(buildAggregateMap(aggregate, { minimumCustomNominations: 2 }).nodes.length, 9);
  assert.equal(buildAggregateMap(aggregate, { minimumCustomNominations: 3 }).nodes.length, 8);
});
