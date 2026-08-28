/**
 * Comfy Cloud partner nodes run a curated workflow on Comfy Cloud GPUs, billed
 * per call. They are `api_node`s like every other partner node, so nothing in
 * the node definition distinguishes them except the module that defines them.
 */
const COMFY_CLOUD_PYTHON_MODULE = 'comfy_api_nodes.nodes_comfy_cloud'

/**
 * The canvas accent for a Comfy Cloud node.
 *
 * Deliberately NOT an entry in `LGraphCanvas.node_colors`: that palette is the
 * user's right-click Colors menu, and letting any node be painted "Comfy Cloud"
 * would destroy the signal this is meant to carry. It is also darker and cooler
 * than the stock `yellow` preset (#432/#653), which is a warm brown, so a
 * branded node cannot be confused with one a user coloured yellow by hand.
 *
 * `color` is the header and `bgcolor` the body, matching litegraph's convention
 * that the body sits lighter than the header.
 */
export const COMFY_CLOUD_NODE_COLOR = {
  color: '#2f3520',
  bgcolor: '#454f2c'
} as const

/** Whether a node definition's python module is the Comfy Cloud node module. */
export function isComfyCloudNodeModule(pythonModule: string | undefined) {
  return pythonModule === COMFY_CLOUD_PYTHON_MODULE
}
