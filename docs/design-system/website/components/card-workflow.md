---
id: website.card-workflow
component: CardWorkflow01
implementation: apps/website/src/components/blocks/CardWorkflow01.vue
status: approved
provenance: established-website-code
variants: default, compact
sizes: default
class_policy: none
---

# CardWorkflow01

Established website media-card anatomy: contained surface, inset 4:3 media,
title, optional description, and subtle tags. The compact variant is the
approved dense-grid treatment.

`statusBadges` accepts only the governed `day-zero` and `open-weights` roles.
`CardWorkflow01` maps those roles to the approved `Badge` variants; call sites
provide localized labels but cannot choose their visual treatment. Status
badges render before descriptive `subtle` tags.

Status badges use the governed `Badge` `md` size. Descriptive tags use the
`card` size. Neither group may use call-site padding or type-size overrides.

`statusBadgePlacement="featured-media"` is the approved featured-card
treatment. It places the status group 24px from the media's top and left edges
and uses the 28px-high `feature` badge size. The default remains `content`, so
collection-card badges do not move or change size.

The `placeholder` media type exists for explicitly design-only work. Its named
media slot preserves the approved card geometry without connecting production
media or inventing a separate placeholder card.

Production card stills use the existing `image` media type. The component owns
the 4:3 crop, `object-cover` behavior, lazy loading, and asynchronous decoding.
Editorial preview images are decorative because the adjacent card title and
description provide the link's accessible name and context, so their alt text
is empty. A call site must keep the governed placeholder when no exact,
Comfy-owned still is available.

Cards with an `href` are linked by the existing full-card overlay. Links open
in a new tab by default to preserve established workflow-gallery behavior.
Internal destinations must explicitly use `target: '_self'`; external links
receive `noopener noreferrer` through the shared CTA utility.
