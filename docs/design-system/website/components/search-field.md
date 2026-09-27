---
id: website.search-field
component: SearchField
implementation: apps/website/src/components/ui/search-field/SearchField.vue
status: approved
provenance: shipped-comfy-workflows
source_reference: https://comfy.org/workflows/
variants: default
sizes: default
class_policy: none
---

# SearchField

Reusable public-website search field derived from the shipped `/workflows`
search. Its 48 px height, rounded website surface, search icon, semantic focus
ring, optional slash shortcut, accessible label, and live status region are one
component contract.

Page code supplies localized label, placeholder, model value, and result status.
It must not recreate the search shell or add call-site visual classes.
