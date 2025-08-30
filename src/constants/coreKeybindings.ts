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
      key: 'KeyR'
    },
    commandId: 'Comfy.RefreshNodeDefinitions'
  },
  {
    combo: {
      key: 'KeyQ'
    },
    commandId: 'Workspace.ToggleSidebarTab.queue'
  },
  {
    combo: {
      key: 'KeyW'
    },
    commandId: 'Workspace.ToggleSidebarTab.workflows'
  },
  {
    combo: {
      key: 'KeyN'
    },
    commandId: 'Workspace.ToggleSidebarTab.node-library'
  },
  {
    combo: {
      key: 'KeyM'
    },
    commandId: 'Workspace.ToggleSidebarTab.model-library'
  },
  {
    combo: {
      key: 'KeyS',
      ctrl: true
    },
    commandId: 'Comfy.SaveWorkflow'
  },
  {
    combo: {
      key: 'KeyO',
      ctrl: true
    },
    commandId: 'Comfy.OpenWorkflow'
  },
  {
    combo: {
      key: 'KeyG',
      ctrl: true
    },
    commandId: 'Comfy.Graph.GroupSelectedNodes'
  },
  {
    combo: {
      key: 'Comma',
      ctrl: true
    },
    commandId: 'Comfy.ShowSettingsDialog'
  },
  // For '=' both holding shift and not holding shift
  {
    combo: {
      key: 'Equal',
      alt: true
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'Equal',
      alt: true,
      shift: true
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  // For number pad '+'
  {
    combo: {
      key: 'NumpadAdd',
      alt: true
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'Minus',
      alt: true
    },
    commandId: 'Comfy.Canvas.ZoomOut',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'Period'
    },
    commandId: 'Comfy.Canvas.FitView',
    targetElementId: 'graph-canvas-container'
  },
  {
    combo: {
      key: 'KeyP'
    },
    commandId: 'Comfy.Canvas.ToggleSelected.Pin',
    targetElementId: 'graph-canvas-container'
  },
  {
    combo: {
      key: 'KeyC',
      alt: true
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
    targetElementId: 'graph-canvas-container'
  },
  {
    combo: {
      key: 'KeyB',
      ctrl: true
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
    targetElementId: 'graph-canvas-container'
  },
  {
    combo: {
      key: 'KeyM',
      ctrl: true
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
    targetElementId: 'graph-canvas-container'
  },
  {
    combo: {
      key: 'Backquote',
      ctrl: true
    },
    commandId: 'Workspace.ToggleBottomPanelTab.logs-terminal'
  },
  {
    combo: {
      key: 'KeyF'
    },
    commandId: 'Workspace.ToggleFocusMode'
  },
  {
    combo: {
      key: 'KeyE',
      ctrl: true,
      shift: true
    },
    commandId: 'Comfy.Graph.ConvertToSubgraph'
  },
  {
    combo: {
      key: 'KeyM',
      alt: true
    },
    commandId: 'Comfy.Canvas.ToggleMinimap'
  },
  {
    combo: {
      ctrl: true,
      shift: true,
      key: 'KeyK'
    },
    commandId: 'Workspace.ToggleBottomPanel.Shortcuts'
  },
  {
    combo: {
      key: 'KeyV'
    },
    commandId: 'Comfy.Canvas.Unlock'
  },
  {
    combo: {
      key: 'KeyH'
    },
    commandId: 'Comfy.Canvas.Lock'
  },
  {
    combo: {
      key: 'Escape'
    },
    commandId: 'Comfy.Graph.ExitSubgraph'
  }
]
