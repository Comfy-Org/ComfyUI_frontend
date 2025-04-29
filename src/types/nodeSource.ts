export enum NodeSourceType {
  Core = 'core',
  CustomNodes = 'custom_nodes',
  Unknown = 'unknown'
}

export type NodeSource = {
  type: NodeSourceType
  className: string
  displayText: string
  badgeText: string
}

const UNKNOWN_NODE_SOURCE: NodeSource = {
  type: NodeSourceType.Unknown,
  className: 'comfy-unknown',
  displayText: 'Unknown',
  badgeText: '?'
}

const shortenNodeName = (name: string) => {
  return name
    .replace(/^(ComfyUI-|ComfyUI_|Comfy-|Comfy_)/, '')
    .replace(/(-ComfyUI|_ComfyUI|-Comfy|_Comfy)$/, '')
}

export const getNodeSource = (python_module?: string): NodeSource => {
  if (!python_module) {
    return UNKNOWN_NODE_SOURCE
  }
  const modules = python_module.split('.')
  if (['nodes', 'comfy_extras', 'comfy_api_nodes'].includes(modules[0])) {
    return {
      type: NodeSourceType.Core,
      className: 'comfy-core',
      displayText: 'Comfy Core',
      badgeText: '🦊'
    }
  } else if (modules[0] === 'custom_nodes') {
    const moduleName = modules[1]
    // Custom nodes installed via ComfyNodeRegistry will be in the format of
    // custom_nodes.<custom node name>@<version>
    const customNodeName = moduleName.split('@')[0]
    const displayName = shortenNodeName(customNodeName)
    return {
      type: NodeSourceType.CustomNodes,
      className: 'comfy-custom-nodes',
      displayText: displayName,
      badgeText: displayName
    }
  } else {
    return UNKNOWN_NODE_SOURCE
  }
}

export enum NodeBadgeMode {
  None = 'None',
  ShowAll = 'Show all',
  HideBuiltIn = 'Hide built-in'
}
