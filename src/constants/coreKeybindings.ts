import type { Keybinding } from '@/schemas/keyBindingSchema'

export const CORE_KEYBINDINGS: Keybinding[] = [
  {
    combo: {
      ctrl: true,
      key: 'Enter'
    },
    commandId: 'Comfy.QueuePrompt'
  },
  {
    combo: {
      ctrl: true,
      shift: true,
      key: 'Enter'
    },
    commandId: 'Comfy.QueuePromptFront'
  },
  {
    combo: {
      ctrl: true,
      alt: true,
      key: 'Enter'
    },
    commandId: 'Comfy.Interrupt'
  },
  {
    combo: {
      key: 'r'
    },
    commandId: 'Comfy.RefreshNodeDefinitions'
  },
  {
    combo: {
      key: 'q'
    },
    commandId: 'Workspace.ToggleSidebarTab.queue'
  },
  {
    combo: {
      key: 'w'
    },
    commandId: 'Workspace.ToggleSidebarTab.workflows'
  },
  {
    combo: {
      key: 'n'
    },
    commandId: 'Workspace.ToggleSidebarTab.node-library'
  },
  {
    combo: {
      key: 'm'
    },
    commandId: 'Workspace.ToggleSidebarTab.model-library'
  },
  {
    combo: {
      key: 's',
      ctrl: true
    },
    commandId: 'Comfy.SaveWorkflow'
  },
  {
    combo: {
      key: 'o',
      ctrl: true
    },
    commandId: 'Comfy.OpenWorkflow'
  },
  {
    combo: {
      key: 'Backspace'
    },
    commandId: 'Comfy.ClearWorkflow'
  },
  {
    combo: {
      key: 'g',
      ctrl: true
    },
    commandId: 'Comfy.Graph.GroupSelectedNodes'
  },
  {
    combo: {
      key: ',',
      ctrl: true
    },
    commandId: 'Comfy.ShowSettingsDialog'
  },
  // For '=' both holding shift and not holding shift
  {
    combo: {
      key: '=',
      alt: true
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '+',
      alt: true,
      shift: true
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  // For number pad '+'
  {
    combo: {
      key: '+',
      alt: true
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '-',
      alt: true
    },
    commandId: 'Comfy.Canvas.ZoomOut',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '.'
    },
    commandId: 'Comfy.Canvas.FitView',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'p'
    },
    commandId: 'Comfy.Canvas.ToggleSelected.Pin',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'c',
      alt: true
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'b',
      ctrl: true
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'm',
      ctrl: true
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '`',
      ctrl: true
    },
    commandId: 'Workspace.ToggleBottomPanelTab.logs-terminal'
  },
  {
    combo: {
      key: 'f'
    },
    commandId: 'Workspace.ToggleFocusMode'
  }
]
