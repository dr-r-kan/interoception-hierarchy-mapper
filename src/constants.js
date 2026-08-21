import config from '../config.json' with { type: 'json' };

export const APP_CONFIG = config;
export const APP_NAME = config.app.name;
export const APP_VERSION = '0.2.0';
export const SCHEMA_NAME = 'interoception-hierarchical-network';
export const SCHEMA_VERSION = '1.1.0';
export const STORAGE_KEY = 'interoception-hierarchy-mapper:v1';
export const THEME_KEY = 'interoception-hierarchy-mapper:theme';

export const CANVAS_WIDTH = 1580;
export const TIER_HEIGHT = 270;
export const TIER_LABEL_WIDTH = 172;
export const NODE_WIDTH = 198;
export const NODE_HEIGHT = 110;

export const SOURCE_FRAMEWORK = config.sourceFramework;
export const STARTER_CARDS = config.cards.map((card) => ({ ...card, sourceKey: card.id }));
export const DEFAULT_TIERS = config.tiers;
export const DEFAULT_HIERARCHY_PROMPT = config.app.hierarchyInstruction;
export const DEFAULT_STUDY_TITLE = config.app.studyTitle;
export const UNPLACED_LABEL = config.app.unplacedLabel;
export const CONNECTOR_TYPES = config.connectorTypes;
export const CONNECTOR_COLOUR = CONNECTOR_TYPES.find((connector) => connector.id === 'unidirectional')?.colour || '#2f81a7';
