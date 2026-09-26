# Supported Model Detail Preview

Status: first governed detail-page composition, design preview only

Reference mockup: [Wan 2.6 model detail](https://www.figma.com/design/11vkE4FAn4plEYpawd57zS/Comfy----Website-Design?node-id=11867-374003),
node `11867:374003`.

## Scope

The preview route is `/p/supported-models/wan-2-6/`. Wan 2.6 is not currently
an entry in the generated website model catalog, so this route is intentionally
static. It must not be used to infer production model data or to alter every
generated detail page.

The explore-page hero, editorial card, and Wan-family row may link directly to
this reviewed route. The route remains outside generated catalog search until
the workflow-template source exposes a stable Wan 2.6 model record rather than
only provider-level API entries.

The shipped website remains the component authority. Figma establishes the
page hierarchy, content direction, and owned preview media.

## Provenance map

| Page element       | Approved source                            | Usage                                                     |
| ------------------ | ------------------------------------------ | --------------------------------------------------------- |
| Page shell         | `BaseLayout.astro`                         | Existing header, footer, metadata, and JSON-LD            |
| Breadcrumb         | `BreadcrumbBar.vue`                        | Existing website breadcrumb anatomy                       |
| Headings           | `SectionHeader.vue` and `SectionLabel.vue` | Existing hero and section typography                      |
| Actions            | `BrandButton.vue`                          | Existing solid and outline link variants                  |
| Status labels      | `Badge.vue`                                | Plum `callout` Open Weights plus descriptive tags         |
| Workflow cards     | `CardWorkflow01.vue`                       | Existing compact card anatomy with supplied Figma media   |
| FAQ                | `FAQSplit01.vue`                           | Existing accordion behavior and focus states              |
| Gallery            | Page composition                           | Static semantic figures using exact Figma-supplied assets |
| Information tables | Page composition                           | Non-interactive semantic content on website surfaces      |
| Code sample        | Page composition                           | Static preview; no copied or runnable secret values       |

## Explicit preview boundaries

- The playground is a static prompt/result composition. Prompt editing,
  settings, credit calculations, loading, errors, and generation are not
  implemented.
- Version selection is omitted because no governed selector and no approved
  version-routing behavior exists for the website.
- Playground and quickstart tabs are omitted rather than rendered as controls
  that do not change content.
- Workflow and comparison destinations use reviewed general Comfy pages. They
  do not claim model-specific routes that are absent from the catalog.
- Pricing language is deliberately non-numeric until a current production
  price source is connected.
- Gallery and workflow images are design fixtures supplied by the Figma node;
  they are not production CMS records.

## Acceptance gates

- The route builds without changing the generated `[slug].astro` template.
- Existing website components receive no page-local visual overrides.
- All action-like elements are real links with reviewed destinations.
- The page remains usable at narrow and wide viewport sizes.
- Production data, generation, authentication, and media attribution remain a
  separate integration phase.
