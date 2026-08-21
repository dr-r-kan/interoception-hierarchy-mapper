# Interoceptive Hierarchy Mapper

A local, browser-based workshop tool for eliciting hierarchical, directed and weighted models of interoception. It is built in React and includes a pre-built copy, so participants do not need Node.js or internet access once the folder has been obtained.

**Use the hosted mapper:** https://dr-r-kan.github.io/interoception-hierarchy-mapper/

The participant workflow is deliberately independent: each person constructs a map in their own browser, then exports one JSON file. An organiser can load all exported files into the same application to inspect an aggregate network and export node and edge tables.

## Included default cards

The default set retains the eight dimensions in Table 1 of the source framework and adds appraisal as a separate card:

> Suksasilp, C., & Garfinkel, S. N. (2022). *Towards a comprehensive assessment of interoception in a multi-dimensional framework*. Biological Psychology, 168, 108262. https://doi.org/10.1016/j.biopsycho.2022.108262

The cards are:

1. Neural representation
2. Strength of afferent signals
3. Preconscious impact of afferent signals
4. Interoceptive accuracy
5. Self-report and interoceptive beliefs
6. Interoceptive insight
7. Interoceptive attention
8. Attribution of interoceptive sensations
9. Appraisal of interoceptive sensations

Definitions in the interface are concise paraphrases. Default cards have stable machine-readable identifiers, which prevents accidental label variation from breaking aggregation. Attribution keeps its existing `sg-attribution` identifier; appraisal uses `interoceptive-appraisal`.

## Fastest way to run it

For normal use, open the [hosted mapper](https://dr-r-kan.github.io/interoception-hierarchy-mapper/). Work stays in that browser until it is exported; the site has no server-side data collection.

For an offline workshop, download the repository from GitHub (**Code → Download ZIP**), extract it, and use one of the launch methods below.

### Windows

Double-click `start_windows.bat`.

### macOS or Linux

Open a terminal in this folder and run:

```bash
./start_mac_linux.sh
```

Alternatively, on any platform with Python 3:

```bash
python serve.py
```

The launcher opens `http://127.0.0.1:8000/`. No installation, database, account or internet connection is required.

Do not open `dist/index.html` directly by double-clicking it. Modern browsers restrict JavaScript modules loaded from `file://`; use the small local server above.

## Participant workflow

1. Open **Study setup** and enter the pseudonymous participant code, optional expertise group, hierarchy instruction and tier labels.
2. Drag cards from the **Unplaced card tray** into ranked tiers. Horizontal position is retained for legibility but is not interpreted as rank.
3. Select **Connect cards**, then select a source card and a target card.
4. Rate the arrow's strength and confidence from 1–5 and enter free-text context or description.
5. Enter a reverse arrow separately where appropriate. A bidirectional relationship is therefore two arrows, and each direction may have different ratings and context.
6. Add missing constructs with **Add card**. Added cards are visibly marked and remain distinguishable in the exported data.
7. Select **Export JSON**. The browser downloads one self-contained participant file.

The current map autosaves to that browser's local storage. A refresh should therefore preserve work, but the JSON export is the durable record and should still be collected before participants leave.

## Organiser aggregation

Open **Aggregate files** and select any number of exported participant JSON files. The application computes and displays:

- node nomination count and prevalence;
- mean relative hierarchy position and its standard deviation;
- directed-edge endorsement count;
- overall edge prevalence;
- prevalence conditional on both endpoint cards being present;
- mean and standard deviation of strength and confidence among endorsers;
- prevalence-weighted mean strength;
- reciprocal endorsement count and prevalence;
- pooled free-text connection context.

The aggregate view can export:

- aggregate JSON;
- node CSV;
- edge CSV.

Two demonstration files are supplied in `sample_data/` so that organiser mode can be tested immediately.

## Aggregation definitions

### Hierarchy

Each participant's ranked tiers are converted to a relative score from 0 (highest tier) to 1 (lowest tier), excluding the unplaced tray. This permits comparison when participants use different numbers or names of tiers. The aggregate board rounds the mean relative score into five display bands; the exported table retains the continuous mean and standard deviation.

### Fixed cards

Starter cards are matched by stable identifiers rather than displayed labels.

### Participant-added cards

Added cards are provisionally grouped only when their titles match after case, punctuation and whitespace normalisation. This does **not** solve semantic equivalence. Before formal analysis, an organiser should manually reconcile synonyms, near-synonyms, broader/narrower concepts and accidental duplicates, preserving the original labels and an auditable coding table.

### Directed edges

An edge from A to B is distinct from B to A. A bidirectional relationship is stored unambiguously as two edge records, A→B and B→A. Reciprocal endorsement counts require both records to occur in the same participant map. `prevalenceAll` uses all imported maps as the denominator. `prevalenceEligible` uses only maps containing both endpoint cards. For fixed-card edges these denominators will normally coincide; for links involving participant-added cards they may differ materially.

The displayed edge width is based on:

```text
prevalence-weighted strength = overall prevalence × mean strength among endorsers
```

This is useful descriptively, but it should not be treated as a validated psychometric estimator without a prespecified analysis plan.

## Running on a laptop hotspot or local network

To make the static application available to other devices on the same network:

```bash
python serve.py --lan
```

The terminal prints candidate network addresses such as `http://192.168.x.x:8000/`. Participants open that address in a browser. The laptop only serves the application files: participant maps remain in each participant's browser and are **not** submitted back to the laptop. Participants must export and transfer their JSON files separately.

This design removes reliance on internet access and avoids a data-receiving backend. It does not provide live collection, authentication or collaborative editing.

## Development

Node.js 20 or later is recommended. The supplied build was produced with Node.js 22.

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

Run the unit tests with:

```bash
npm test
```

The main dependencies are React, Vite and `@xyflow/react` (React Flow). The application itself makes no network requests during normal use.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy-pages.yml` tests, builds and deploys the app whenever `main` changes. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The Vite build uses relative asset paths, so it works at the repository subpath without a custom domain or repository-specific configuration.

## Reuse the mapper for another project

All default cards, descriptions, tiers, the hierarchy instruction and connector wording live in [`config.json`](config.json). Duplicate or fork this repository, edit that file, then rebuild. No React changes are needed for ordinary content reuse.

### Change a card or description

Edit the matching object in `cards`:

```json
{
  "id": "sg-attribution",
  "title": "Attribution of interoceptive sensations",
  "description": "A revised working definition."
}
```

Keep `id` unchanged once participant files have been collected. Aggregation uses the ID, not the displayed title, to match default cards across files.

### Add or remove a card

Add another object to `cards` with a new ID:

```json
{
  "id": "project-prediction-error",
  "title": "Prediction error",
  "description": "Mismatch between an expected and observed signal."
}
```

To remove a default card, delete its complete object. Every card ID must be non-empty and unique. Use short, durable IDs containing letters, numbers and hyphens; do not recycle a removed ID for a different concept. Existing participant exports remain self-contained and can still be imported.

### Change tiers and instructions

Edit `app.studyTitle`, `app.hierarchyInstruction`, `app.unplacedLabel`, or the `tiers` array. Each tier needs a unique, stable `id` and a participant-facing `label`:

```json
"tiers": [
  { "id": "strategic", "label": "Strategic" },
  { "id": "operational", "label": "Operational" }
]
```

Changing tier labels is safe. Avoid changing tier IDs during one collection round; although aggregate hierarchy positions are normalised, stable IDs make individual files easier to compare and audit.

### Change connector wording

`connectorTypes` documents the two supported patterns: one directed arrow, or a bidirectional relationship made from two opposite arrows. The app deliberately has no effect-type dropdown. You may change the participant-facing labels, descriptions, symbols and the unidirectional arrow colour, while keeping the IDs `unidirectional` and `bidirectional`:

```json
"connectorTypes": [
  {
    "id": "unidirectional",
    "label": "One-way dependency",
    "description": "Create one arrow from the source to the target.",
    "symbol": "→",
    "colour": "#2f81a7"
  },
  {
    "id": "bidirectional",
    "label": "Mutual dependency",
    "description": "Create two arrows, one in each direction.",
    "symbol": "↔"
  }
]
```

Edit `connection.contextLabel` and `connection.contextPlaceholder` to change the free-text prompt. Adding other connector IDs does not add new relationship behaviour; the data model intentionally remains directed arrows plus reciprocal pairs.

### Validate, rebuild and redeploy

After editing `config.json`:

```bash
npm ci
npm test
npm run build
```

Use `python serve.py` to check the rebuilt `dist` folder locally. Commit `config.json` and the rebuilt `dist` files, then push to `main`; the existing GitHub Pages workflow redeploys the same public URL automatically. In a fork, enable **Settings → Pages → Source: GitHub Actions** once before the first deployment.

## Data structure

Each participant export contains:

- schema and application versions;
- participant/session metadata;
- source-framework metadata;
- tier definitions;
- nodes, including origin, definition, tier and canvas position;
- directed edges, including strength, confidence and free-text context;
- a small validation summary.

The current schema identifier is `interoception-hierarchical-network`, version `1.1.0`. Participant files created by app version `0.1.0` / schema version `1.0.0` remain importable: old `rationale` text becomes `context`, old effect values are retained as `legacyEffect`, and reciprocal arrows remain separate directed records.

## Research-use cautions

This is a working elicitation prototype, not a complete study protocol. Before deploying it as research rather than informal consultation, specify at minimum:

- the construct and intended meaning of hierarchy;
- participant inclusion criteria and expertise reporting;
- whether discussion occurs before or after independent mapping;
- whether connection context is mandatory;
- handling of missing/unplaced cards;
- rules for reconciling added cards;
- consensus thresholds and stopping criteria across rounds;
- treatment of confidence ratings;
- qualitative analysis of connection context;
- preregistration, consent, data governance and authorship arrangements.

Participant codes and free text can still constitute research data. Use pseudonymous identifiers and handle exported files under the applicable ethics approval and institutional policy.

## Browser support

Recent versions of Chrome, Edge, Firefox and Safari should work. The interface uses Pointer Events and is intended to support mouse, trackpad and touchscreen input. Test the exact iPad/Safari and venue-network configuration before the session.

## Licence

Application code is supplied under the MIT Licence. The cited source article is open access under its stated licence; this repository does not redistribute the article.
