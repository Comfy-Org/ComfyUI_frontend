export type NodeSourceType = 'core' | 'custom_nodes'
export type NodeSource = {
  type: NodeSourceType
  className: string
  displayText: string
}

export const getNodeSource = (python_module: string): NodeSource => {
  const modules = python_module.split('.')
  if (['nodes', 'comfy_extras'].includes(modules[0])) {
    return {
      type: 'core',
      className: 'comfy-core',
      displayText: 'Comfy Core'
    }
  } else if (modules[0] === 'custom_nodes') {
    return {
      type: 'custom_nodes',
      className: 'comfy-custom-nodes',
      displayText: modules[1]
    }
  } else {
    throw new Error(`Unknown node source: ${python_module}`)
  }
}
