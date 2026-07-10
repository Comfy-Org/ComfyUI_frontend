# In-App Agent panel (FE-1187)

The In-App Agent panel is a manager-pattern workbench extension. The panel lives
entirely in this subtree and renders in a flag-gated right dock registered by
`src/extensions/core/agentPanel.ts`, so it shares the host pinia and vue-i18n
instances and wires every host dependency itself (REST client, `/ws` event source,
draft-to-canvas seam).
