const CANVAS_MUTATING_TOOLS = new Set([
  'add_node',
  'delete_node',
  'set_widget',
  'connect',
  'disconnect',
  'clear_canvas',
  'apply_ops',
  'insert_workflow',
  'get_template',
  'generate_workflow',
  'define_subgraph'
])

const CANVAS_CONTENT_TOOLS = new Set([
  'add_node',
  'set_widget',
  'connect',
  'apply_ops',
  'insert_workflow',
  'get_template',
  'generate_workflow',
  'define_subgraph',
  'print_workflow'
])

export function toolCanMutateCanvas(name: string): boolean {
  return CANVAS_MUTATING_TOOLS.has(name)
}

export function toolCanClaimCanvasContent(name: string): boolean {
  return CANVAS_CONTENT_TOOLS.has(name)
}
