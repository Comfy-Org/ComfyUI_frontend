# In-App Agent panel (FE-1187)

The In-App Agent panel is a manager-pattern workbench extension. The panel lives
entirely in this subtree and renders in a flag-gated right dock registered by
`src/extensions/core/agentPanel.ts`, so it shares the host pinia and vue-i18n
instances and wires every host dependency itself (REST client, `/ws` event source,
draft-to-canvas seam).

## Staged (built, tested, not yet wired)

These surfaces are complete and covered by tests but are not wired into the shipped panel
yet; they are V0 tech-design surfaces awaiting host wiring:

- `components/agent/ActiveTabStrip.vue` - tab context
- `components/agent/composer/AssetTray.vue` - cloud-asset @-tag tray
- `components/agent/composer/SelectionActionChips.vue` - canvas selection
- `composables/agent/useCanvasSelection.ts` - canvas selection

## UI primitives

The panel intentionally keeps its own UI primitives (`components/ui/*`) pending a separate
design-system reconciliation PR.
