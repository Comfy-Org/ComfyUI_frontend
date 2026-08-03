# Template Ranking System

How the template picker orders results, and how curators influence that order.

There are two independent orderings: **search** (a query is active) and **browse** (no query). They use different code paths and different signals.

## Search ordering

Implemented in [`src/composables/templateSearchConfig.ts`](../src/composables/templateSearchConfig.ts).

`searchTemplates()` runs MiniSearch (BM25) over `title`, `description`, `tags`, `models` and `name`, with field boosts `title ×3`, `models ×2`, `tags ×2`, `name ×1`, `description ×0.5`. It searches with `AND`, falls back to `OR` if that returns nothing, then repeats both for the abbreviation-expanded query (`i2v` → `image video`) and appends the deduplicated extras.

`rankByRelevanceThenUsage()` then orders the hits:

1. Each hit's relevance score is scaled by its curation multiplier — `1 + searchRankBoost(searchRank) × 0.3`, so curation can move a hit by at most ±30%.
2. Scores are bucketed into bands of 5% of the top score. Different band → higher score wins.
3. Same band → higher `usage` wins, dampened with `log1p`.

Bucketing keeps the result a stable total order; a pairwise "within X%" comparison is intransitive and would make the order depend on input order.

The ±30% cap is the deliberate balance: it is roughly six tiebreak bands, enough for a curated launch template to clear near-equal matches, and never enough to drag a weak match to the top. Curation cannot introduce a template that does not match the query at all.

## Browse ordering (sort dropdown)

Implemented in [`src/composables/useTemplateFiltering.ts`](../src/composables/useTemplateFiltering.ts).

| Mode                     | Ordering                                                        |
| ------------------------ | --------------------------------------------------------------- |
| `relevance`              | Search order, unmodified. Auto-selected while a query is active |
| `default`                | The array order of `templates/index.json`                       |
| `recommended`            | `usage × 0.5 + curation × 0.3 + freshness × 0.2`                |
| `popular`                | Raw `usage`, descending                                         |
| `newest`                 | `date`, descending                                              |
| `alphabetical`           | Displayed title, A→Z, number-prefixed titles last               |
| `model-size-low-to-high` | `size`, ascending                                               |

`default` is a deliberate pass-through: the order of `templates/index.json` is the editorial lever owned by the `workflow_templates` repo. Reordering entries there is what changes the default browse order. See [#7062](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7062) for why this is not a computed blend.

`freshness` is computed at runtime from `template.date` as `max(0.1, 1 / (1 + daysSinceAdded / 90))`. `curation` is `searchRankBoost(searchRank)` shifted from `[-1, 1]` into `[0, 1]`, so an uncurated template sits at the 0.5 midpoint.

## `searchRank`

Set per template in the `workflow_templates` repo's `templates/index.json`. It is the manual override curators use to surface important templates — for example the templates accompanying a model launch.

```json
{
  "name": "video_minimax_h3_i2v",
  "searchRank": 1000
}
```

| `searchRank`   | Effect                                    |
| -------------- | ----------------------------------------- |
| absent, or `0` | Neutral. No influence on ordering         |
| `1` … `1000`   | Promote, with rapidly diminishing returns |
| above `1000`   | Same as `1000`. Saturated, never larger   |
| negative       | Demote, mirroring the positive curve      |

Magnitude follows `log1p(|searchRank|) / log1p(1000)`, capped at 1. The curve is logarithmic so the whole documented `0`–`1000` range from [`workflow_templates/docs/SPEC.md`](https://github.com/Comfy-Org/workflow_templates/blob/main/docs/SPEC.md) is usable, and saturating so an out-of-range value cannot swamp relevance:

| `searchRank` | Boost | Search multiplier |
| ------------ | ----- | ----------------- |
| `0`          | 0.00  | 1.00×             |
| `8`          | 0.32  | 1.10×             |
| `100`        | 0.67  | 1.20×             |
| `500`        | 0.90  | 1.27×             |
| `1000`       | 1.00  | 1.30×             |
| `1000000`    | 1.00  | 1.30×             |

### Why `0` is neutral rather than a demotion

`workflow_templates` documents the field as "0-1000, higher = better ranking", and its tooling writes an explicit `"searchRank": 0` onto templates that nobody has curated — the majority of the catalog. Treating `0` as a demotion would therefore bury most templates beneath the minority that simply omit the field. Explicit demotion uses negative values instead.

## `usage`

A per-template count shipped in `templates/index.json`, refreshed periodically from real usage data. It drives the `popular` sort, the `recommended` blend, and the search tiebreak within a score band.

Raw usage reflects both genuine preference and UI position bias, so it is normalized offline before being committed. Position-bias correction uses linear interpolation, giving templates buried further down up to a 2× correction:

```
correction = 1 + (position - 1) / (maxPosition - 1)
normalizedUsage = rawUsage × correction
```
