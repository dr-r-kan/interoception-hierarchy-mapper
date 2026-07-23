export const APP_NAME = 'Interoceptive Hierarchy Mapper';
export const APP_VERSION = '0.1.0';
export const SCHEMA_NAME = 'interoception-hierarchical-network';
export const SCHEMA_VERSION = '1.0.0';
export const STORAGE_KEY = 'interoception-hierarchy-mapper:v1';

export const CANVAS_WIDTH = 1580;
export const TIER_HEIGHT = 270;
export const TIER_LABEL_WIDTH = 172;
export const NODE_WIDTH = 198;
export const NODE_HEIGHT = 110;

export const SOURCE_FRAMEWORK = {
  id: 'suksasilp-garfinkel-2022',
  authors: 'Suksasilp, C. & Garfinkel, S. N.',
  year: 2022,
  title: 'Towards a comprehensive assessment of interoception in a multi-dimensional framework',
  journal: 'Biological Psychology',
  volume: '168',
  article: '108262',
  doi: '10.1016/j.biopsycho.2022.108262',
  url: 'https://doi.org/10.1016/j.biopsycho.2022.108262',
};

// Labels follow Table 1 of Suksasilp & Garfinkel (2022). Definitions are concise paraphrases.
export const STARTER_CARDS = [
  {
    id: 'sg-neural-representation',
    sourceKey: 'sg-neural-representation',
    title: 'Neural representation',
    description:
      'Central nervous activity involved in interoceptive processing, including coupling between brain activity and afferent physiological signals.',
  },
  {
    id: 'sg-afferent-signal-strength',
    sourceKey: 'sg-afferent-signal-strength',
    title: 'Strength of afferent signals',
    description:
      'The strength and character of peripheral signals conveying internal bodily states to the central nervous system.',
  },
  {
    id: 'sg-preconscious-impact',
    sourceKey: 'sg-preconscious-impact',
    title: 'Preconscious impact of afferent signals',
    description:
      'Effects of afferent fluctuations on central neural activity and on the processing of external information before conscious report.',
  },
  {
    id: 'sg-interoceptive-accuracy',
    sourceKey: 'sg-interoceptive-accuracy',
    title: 'Interoceptive accuracy',
    description:
      'Objective correspondence between measured physiological events and reported experience, usually assessed with behavioural tasks.',
  },
  {
    id: 'sg-self-report-beliefs',
    sourceKey: 'sg-self-report-beliefs',
    title: 'Self-report and interoceptive beliefs',
    description:
      'Conscious or implicit beliefs about interoceptive sensations, aptitude and experience, including questionnaires, confidence and prior beliefs.',
  },
  {
    id: 'sg-interoceptive-insight',
    sourceKey: 'sg-interoceptive-insight',
    title: 'Interoceptive insight',
    description:
      'Metacognitive correspondence between interoceptive performance and perceived performance or confidence.',
  },
  {
    id: 'sg-interoceptive-attention',
    sourceKey: 'sg-interoceptive-attention',
    title: 'Interoceptive attention',
    description:
      'Deliberate or habitual attention to internal bodily sensations, including its balance relative to exteroceptive attention.',
  },
  {
    id: 'sg-attribution',
    sourceKey: 'sg-attribution',
    title: 'Attribution of interoceptive sensations',
    description:
      'Interpretation of interoceptive sensations and their causes, such as construing a sensation as threatening.',
  },
];

export const EFFECT_OPTIONS = [
  { value: 'unspecified', label: 'Direction/effect not specified' },
  { value: 'positive', label: 'Increases, supports or amplifies' },
  { value: 'negative', label: 'Decreases, inhibits or attenuates' },
  { value: 'context-dependent', label: 'Context-dependent or mixed' },
];

export const EFFECT_COLOURS = {
  unspecified: '#52647a',
  positive: '#176b87',
  negative: '#a33a43',
  'context-dependent': '#7251a8',
};

export const DEFAULT_HIERARCHY_PROMPT =
  'Place components from the highest or most abstract level at the top to the lowest or most peripheral level at the bottom. Use the workshop definition of “hierarchy”; vertical order within a tier is not analysed.';
