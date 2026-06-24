// Shared identifiers for the single, teleported view-mode toggle. Graph mode
// and app mode each render a host element with one of these ids; GraphView
// teleports the toggle into whichever host matches the active mode.
export const VIEW_MODE_TOGGLE_HOST_ID = {
  graph: 'graph-actions-toggle-host',
  app: 'app-actions-toggle-host'
} as const

// Telemetry source reported by the toggle, paired to the host it lives in.
export const VIEW_MODE_TOGGLE_SOURCE = {
  graph: 'breadcrumb_subgraph_menu_selected',
  app: 'app_mode_toolbar'
} as const
