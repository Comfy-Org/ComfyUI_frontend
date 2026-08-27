---
id: website.task-tile
component: TaskTile
implementation: apps/website/src/components/ui/task-tile/TaskTile.vue
status: design-proposal
provenance: established-website-patterns
variants: default
sizes: default
class_policy: none
---

# TaskTile

Compact, non-interactive discovery tile for grouping models or workflows by
task. Its surface, corner radius, spacing, and type hierarchy reuse the
established website card patterns in `GlassCard.vue` and `BenefitsGrid01.vue`.

## Anatomy

1. Optional 16:9 media region above the content.
2. Uppercase task title.
3. Short supporting description.
4. Yellow metadata label, such as a model or workflow count.

The media region is supplied through the named `media` slot. During design-only
work it uses the governed model-media placeholder; production imagery, crop
behavior, and loading policy remain intentionally disconnected.

The design-only variant is deliberately non-interactive. A future linked
variant requires an approved destination, focus treatment, hover treatment,
and icon-bearing action pattern before it can be added.
