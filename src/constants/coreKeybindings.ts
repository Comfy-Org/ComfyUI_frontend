import type { Keybinding } from '@/schemas/keyBindingSchema'

export const CORE_KEYBINDINGS: Keybinding[] = [
  {
    combo: {
      ctrl: true,
      key: 'Enter',
      code: 'Enter'
    },
    commandId: 'Comfy.QueuePrompt'
  },
  {
    combo: {
      ctrl: true,
      shift: true,
      key: 'Enter',
      code: 'Enter'
    },
    commandId: 'Comfy.QueuePromptFront'
  },
  {
    combo: {
      ctrl: true,
      alt: true,
      key: 'Enter',
      code: 'Enter'
    },
    commandId: 'Comfy.Interrupt'
  },
  {
    combo: {
      key: 'r',
      code: 'KeyR'
    },
    commandId: 'Comfy.RefreshNodeDefinitions'
  },
  {
    combo: {
      key: 'q',
      code: 'KeyQ'
    },
    commandId: 'Workspace.ToggleSidebarTab.queue'
  },
  {
    combo: {
      key: 'w',
      code: 'KeyW'
    },
    commandId: 'Workspace.ToggleSidebarTab.workflows'
  },
  {
    combo: {
      key: 'n',
      code: 'KeyN'
    },
    commandId: 'Workspace.ToggleSidebarTab.node-library'
  },
  {
    combo: {
      key: 'm',
      code: 'KeyM'
    },
    commandId: 'Workspace.ToggleSidebarTab.model-library'
  },
  {
    combo: {
      key: 's',
      ctrl: true,
      code: 'KeyS'
    },
    commandId: 'Comfy.SaveWorkflow'
  },
  {
    combo: {
      key: 'o',
      ctrl: true,
      code: 'KeyO'
    },
    commandId: 'Comfy.OpenWorkflow'
  },
  {
    combo: {
      key: 'Backspace',
      code: 'Backspace'
    },
    commandId: 'Comfy.ClearWorkflow'
  },
  {
    combo: {
      key: 'g',
      ctrl: true,
      code: 'KeyG'
    },
    commandId: 'Comfy.Graph.GroupSelectedNodes'
  },
  {
    combo: {
      key: ',',
      ctrl: true,
      code: 'Comma'
    },
    commandId: 'Comfy.ShowSettingsDialog'
  },
  // For '=' both holding shift and not holding shift
  {
    combo: {
      key: '=',
      alt: true,
      code: 'Equal'
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '+',
      alt: true,
      shift: true,
      code: 'Equal'
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  // For number pad '+'
  {
    combo: {
      key: '+',
      alt: true,
      code: 'NumpadAdd'
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '-',
      alt: true,
      code: 'NumpadSubtract'
    },
    commandId: 'Comfy.Canvas.ZoomOut',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '.',
      code: 'Period'
    },
    commandId: 'Comfy.Canvas.FitView',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'p',
      code: 'KeyP'
    },
    commandId: 'Comfy.Canvas.ToggleSelected.Pin',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'c',
      alt: true,
      code: 'KeyC'
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'b',
      ctrl: true,
      code: 'KeyB'
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'm',
      ctrl: true,
      code: 'KeyM'
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '`',
      ctrl: true,
      code: 'Backquote'
    },
    commandId: 'Workspace.ToggleBottomPanelTab.logs-terminal'
  },
  {
    combo: {
      key: 'f',
      code: 'KeyF'
    },
    commandId: 'Workspace.ToggleFocusMode'
  },
  {
    combo: {
      key: 'e',
      ctrl: true,
      shift: true,
      code: 'KeyE'
    },
    commandId: 'Comfy.Graph.ConvertToSubgraph'
  },
  {
    combo: {
      key: 'm',
      alt: true
    },
    commandId: 'Comfy.Canvas.ToggleMinimap'
  }
]
