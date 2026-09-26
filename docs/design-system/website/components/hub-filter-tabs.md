---
id: website.hub-filter-tabs
component: HubFilterTabs
implementation: apps/website/src/components/ui/hub-filter-tabs/HubFilterTabs.vue
status: approved
provenance: shipped-comfy-workflows
source_reference: https://comfy.org/workflows/
variants: default
sizes: default
class_policy: none
---

# HubFilterTabs

Reusable website filter-tabs pattern derived from the shipped `/workflows`
toolbar. It owns the rounded bordered group, yellow active pill, muted inactive
states, icons, responsive labels, focus rings, and keyboard tab behavior.

The shell uses the shipped 14px group radius and 10px trigger radius. The list
may contain a compact set of content types or a horizontally scrolling set of
peer categories.

Page code supplies localized items and selection state. It must not recreate or
visually override the filter shell.
