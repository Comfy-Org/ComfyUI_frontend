# Supported Models Explore Page

Status: visually approved preview baseline with recorded exclusions

Visual approval recorded: 2026-08-20. The page design is approved for the
current design-only phase. Carousel pagination and the minor polish items in
the exclusions below are not part of this approval and must not be silently
invented by a future implementation agent.

This contract keeps approved component anatomy separate from production data
and media integration. Every implemented control or reusable visual element
must trace to an approved website component contract.

## Source priority

1. Existing Comfy website components and repeated shipped website patterns.
2. Accessibility and product behavior requirements.
3. The Comfy website mockup as a secondary composition reference.
4. External websites as research for a proposed component, never as direct
   implementation authority.

Reference mockup: [Comfy — Website Design](https://www.figma.com/design/11vkE4FAn4plEYpawd57zS/Comfy----Website-Design?node-id=11867-373835),
node `11867:373835`. The mockup can establish hierarchy and content, but not a
new control, icon, state, or variant.

## Review decisions that produced the approved baseline

These decisions supersede earlier page-local experiments and should be treated
as implementation constraints.

1. The shipped website is the primary visual source. Figma supplies hierarchy
   and content where the website has no equivalent pattern.
2. Header and footer remain the existing `BaseLayout` shell. No page-specific
   navigation, outbound-arrow decoration, or rollover treatment was added.
3. Hero actions use the existing solid and yellow-outline `BrandButton`
   variants. The hero carousel remains a static featured card until its control
   system is approved.
4. Search reuses the `/workflows` search-field anatomy. The unapproved prompt
   suggestions and adjacent model-count control were omitted.
5. Model modality tabs reuse the `/workflows` hub filter, including its icons,
   14px container radius, 10px item radius, selected yellow state, and
   horizontal overflow behavior.
6. Featured, Trending, and Day Zero cards reuse the compact
   `CardWorkflow01` anatomy. The page does not own a separate card system.
7. Day Zero and Open Weights are governed model-status roles. Day Zero maps to
   the yellow slanted `accent` badge; Open Weights maps to the plum slanted
   `callout` badge. Status badges use `md`; descriptive badges use `card`.
8. Task discovery cards gained a governed 16:9 media slot above their content.
   The current imagery remains the approved design-only placeholder treatment.
9. Access cards reuse `ProductCard`. Open Weights uses deep plum; Partner APIs
   uses the same cool-gray semantic surface as Comfy Enterprise, not green.
10. The conversion banner is the exact `/cloud/pricing`
    `PricingFreeBanner`, followed by the existing product-card family.
11. Wan family rows use the established small solid `IconButton` with the
    existing arrow-right asset. Each control is a real link with a
    model-specific accessible label and a canonical Comfy destination.
12. FAQ uses the existing localized `FAQSection`; no page-local accordion
    states were introduced.
13. Editorial model cards link only to reviewed canonical Comfy destinations.
    Shipped launch pages and exact catalog records stay in-tab; the Wan 2.6
    launch article opens as an external Comfy resource. No display-name-based
    route inference is permitted.
14. The hero's Day Zero badge uses the governed featured-media status
    treatment: 28px high and inset 24px from the media's top-left corner. This
    exception applies only to the hero card; collection status badges retain
    their existing content placement and `md` size.

## Approved exclusions and follow-up work

| Item                         | Approval state       | Required next step                                                        |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------- |
| Featured carousel pagination | intentionally absent | Design and document controls, states, motion, and reduced-motion behavior |
| Featured carousel rotation   | intentionally absent | Approve content ownership and carousel behavior before adding state       |
| Search suggestion chips      | blocked gap          | Approve a reusable suggestion-chip component and keyboard behavior        |
| Inline collection actions    | blocked gap          | Approve label, icon, destination, focus, and hover anatomy                |
| Task-card actions            | blocked gap          | Approve destinations and linked-card interaction states                   |
| Production model media       | preview-integrated   | Six exact owned stills plus two governed source-gap fallbacks             |
| Production catalog data      | partially integrated | Generated summary, ItemList, and reviewed card destinations connected     |
| Search and filter behavior   | preview-only         | Controls demonstrate approved anatomy; catalog behavior is not connected  |
| Minor visual polish          | accepted follow-up   | Resolve through the owning component contract, never page-local CSS       |

## Implemented provenance map

| Page element              | Approved source                     | Usage                                                         |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Hero heading              | `SectionHeader.vue`                 | Existing `hero` size and `start` alignment                    |
| Hero actions              | `BrandButton.vue`                   | Existing `solid` and yellow `outline` variants at `nav` size  |
| Search                    | `SearchField.vue`                   | Shipped `/workflows` anatomy and interaction states           |
| Featured and model cards  | `CardWorkflow01.vue`                | Existing compact workflow-card anatomy with placeholder media |
| Model status badges       | `Badge.vue`                         | Slanted `accent` for Day Zero; `callout` for Open Weights     |
| Category selection        | `HubFilterTabs.vue`                 | `/workflows` anatomy with model-modality labels               |
| Trending label            | `SectionLabel.vue`                  | Default label treatment                                       |
| Day-zero model cards      | `CardWorkflow01.vue`                | Reuses the approved compact collection anatomy                |
| Task discovery tiles      | `TaskTile.vue`                      | Governed non-interactive card with 16:9 placeholder media     |
| Access and run-path cards | `ProductCard.vue`                   | Existing website destination-card anatomy                     |
| Free-runs banner          | `PricingFreeBanner.vue`             | Exact shipped `/cloud/pricing` banner anatomy                 |
| Family variant actions    | `IconButton.vue`                    | Solid small arrow links to canonical model information pages  |
| FAQ accordion             | `FAQSection.vue`                    | Existing localized accordion behavior and states              |
| Page shell                | Existing website `BaseLayout.astro` | Header and footer remain unchanged                            |

Page wrappers may control grid, spacing, and placement. They may not redefine
the appearance or states of the approved components above.

## Feature-local composition registry

| Composition                    | Status             | Responsibility                                                 |
| ------------------------------ | ------------------ | -------------------------------------------------------------- |
| `ModelsExploreHero.astro`      | catalog-integrated | Approved anatomy with generated-catalog summary copy           |
| `ModelCategoryFilter.vue`      | design-only        | Demonstrates approved website tabs with model-modality labels  |
| `ModelCollectionSection.astro` | media-integrated   | Approved cards with governed owned stills or explicit fallback |
| `ModelMediaPlaceholder.astro`  | approved-fallback  | Shared decorative fallback for catalog entries without a still |
| `ModelTaskSection.astro`       | design-only        | Task-tile layout and governed placeholder-media composition    |
| `ModelAccessSection.astro`     | design-only        | Two-column layout around approved destination cards            |
| `ModelFamilySection.astro`     | design-only        | Linked family hierarchy with approved placeholder media        |
| `ModelConversionSection.astro` | design-only        | Approved banner action and product-card layout                 |

## Remaining component gaps for lint enforcement

| Needed pattern           | Status              | Current implementation                                           |
| ------------------------ | ------------------- | ---------------------------------------------------------------- |
| Search suggestion chip   | `blocked-gap`       | Omitted; not substituted with a raw button                       |
| Inline collection action | `blocked-gap`       | Omitted until link and icon anatomy are approved                 |
| Task tile action         | `blocked-gap`       | Count remains metadata; linked state and action icon are omitted |
| Featured-model carousel  | `blocked-gap`       | Static card only; invented pagination indicators removed         |
| Model media              | `approved-fallback` | `ModelMediaPlaceholder.astro` where no exact owned still exists  |

A blocked gap must not be filled by copying the mockup CSS. Design the missing
component, document its variants and states, add it to the website registry,
and then restore the page element.

## Catalog integration contract

- `config/models.ts` is the page's authoritative production catalog. It is
  generated from supported workflow templates and enriched by
  `config/model-metadata.ts`.
- The visible catalog count is derived from `models.length`; it must not be a
  manually maintained marketing number.
- Local-component and partner-integration counts are classified by the
  `partner_nodes` directory boundary in `modelExploreCatalog.ts`.
- The page publishes every catalog entry as an `ItemList` linked to its
  canonical `/p/supported-models/{slug}` detail route.
- `workflowCount` values are references per catalog entry. Their sum is not a
  verified unique-workflow count and must not be presented as one.
- Editorial cards remain fixtures until a reviewed mapping exists between each
  promoted concept and one canonical catalog entry. Integration must not guess
  a match based on display-name similarity.
- The reviewed editorial destination map is stored directly with
  `modelExploreFixtures.ts`. Changing a promoted model requires an explicit
  canonical destination and link target in the same change.
- Editorial stills must come from the promoted model's existing Comfy launch
  page configuration or the exact supported-model catalog record. The page
  must not scrape a destination or substitute a visually similar model.
- The shared workflow card owns the 4:3 crop, lazy loading, asynchronous image
  decoding, and decorative alt treatment. Page compositions may not override
  these media rules.
- Flux 3 remains on the governed placeholder because its launch media currently
  has no poster still. Wan 2.6 remains on the placeholder because the website
  repository has no exact owned media record for that release.
- Search and category controls are intentionally presentational in this
  preview. Production query state, classification, result rendering, and empty
  states require a separate implementation pass after preview handoff.

## Remaining prototype boundaries

- Static fixtures exercise text lengths and existing badge variants.
- Six reviewed remote still URLs are connected through existing launch-page or
  catalog ownership; source gaps retain the governed fallback.
- Search and category selection demonstrate the approved control anatomy but
  do not query or filter the generated catalog.
- Placeholder media is decorative and hidden from assistive technology.
- Access, conversion, and FAQ actions use destinations and behavior already
  owned by existing website components.
- Family-row icon links use reviewed canonical Comfy destinations. They are the
  only model-specific links approved during this design phase.
- The document hierarchy remains one `h1`, followed by `h2` and `h3` headings.

## Acceptance gates

### System fidelity

- `pnpm lint:design-system` reports no errors.
- Governed components receive no call-site class overrides.
- Website compositions contain no raw interactive controls, literal action
  arrows, or page-local interaction-state utilities.
- Every omitted mockup element is recorded above as a component gap.

### Visual fidelity

- The existing website header and footer render unchanged.
- The page keeps the complete mockup hierarchy through access choices, model
  family, conversion paths, and FAQ.
- Content remains usable at desktop and narrow viewport widths.
- Visual approval cannot promote a blocked gap into an approved component.

### Integration gate

This handoff is a design preview. Catalog summary data, reviewed media, and
reviewed links are connected where they already support the visual review.
Search, filtering, carousel controls, suggestion chips, and comprehensive link
coverage remain separate production work and are not part of this preview.
