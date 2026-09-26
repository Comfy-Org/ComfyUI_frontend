---
id: website.badge
component: Badge
implementation: apps/website/src/components/ui/badge/Badge.vue
status: approved
provenance: established-website-code
variants: default, subtle, category, accent, callout
sizes: card, feature, md, xs, xxs
class_policy: none
---

# Badge

Compact website metadata and status primitive. Do not recreate category,
accent, callout, or subtle badges with page-local spans.

## Model status roles

Model cards reuse the established slanted badge geometry instead of defining
page-local shapes:

| Model status | Badge variant | Meaning                                     |
| ------------ | ------------- | ------------------------------------------- |
| Day Zero     | `accent`      | Time-sensitive release emphasis, yellow/ink |
| Open Weights | `callout`     | Model availability status, plum/warm-white  |

These role mappings are fixed. Model-status badges use the `md` size. Modality
and descriptive tags remain `subtle` at the `card` size so their secondary
metadata treatment is visually distinct from status.

The `feature` size is reserved for a model status displayed over featured-card
media. It is 28px high and uses the existing slanted status geometry. It must
not replace the smaller `md` status treatment in collection cards.
