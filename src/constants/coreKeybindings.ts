import type { Keybinding } from '@/schemas/keyBindingSchema'

// Helper function to map key characters to their physical key codes
function getKeyCode(key: string): string {
  const keyToCodeMap: Record<string, string> = {
    Enter: 'Enter',
    r: 'KeyR',
    q: 'KeyQ',
    w: 'KeyW',
    n: 'KeyN',
    m: 'KeyM',
    s: 'KeyS',
    o: 'KeyO',
    Backspace: 'Backspace',
    g: 'KeyG',
    ',': 'Comma',
    '=': 'Equal',
    '+': 'Equal', // Same physical key as '='
    '-': 'Minus',
    '.': 'Period',
    p: 'KeyP',
    c: 'KeyC',
    b: 'KeyB',
    '`': 'Backquote',
    f: 'KeyF'
  }
  return keyToCodeMap[key] || key
}

export const CORE_KEYBINDINGS: Keybinding[] = [
  {
    combo: {
      ctrl: true,
      key: 'Enter',
      code: getKeyCode('Enter')
    },
    commandId: 'Comfy.QueuePrompt'
  },
  {
    combo: {
      ctrl: true,
      shift: true,
      key: 'Enter',
      code: getKeyCode('Enter')
    },
    commandId: 'Comfy.QueuePromptFront'
  },
  {
    combo: {
      ctrl: true,
      alt: true,
      key: 'Enter',
      code: getKeyCode('Enter')
    },
    commandId: 'Comfy.Interrupt'
  },
  {
    combo: {
      key: 'r',
      code: getKeyCode('r')
    },
    commandId: 'Comfy.RefreshNodeDefinitions'
  },
  {
    combo: {
      key: 'q',
      code: getKeyCode('q')
    },
    commandId: 'Workspace.ToggleSidebarTab.queue'
  },
  {
    combo: {
      key: 'w',
      code: getKeyCode('w')
    },
    commandId: 'Workspace.ToggleSidebarTab.workflows'
  },
  {
    combo: {
      key: 'n',
      code: getKeyCode('n')
    },
    commandId: 'Workspace.ToggleSidebarTab.node-library'
  },
  {
    combo: {
      key: 'm',
      code: getKeyCode('m')
    },
    commandId: 'Workspace.ToggleSidebarTab.model-library'
  },
  {
    combo: {
      key: 's',
      ctrl: true,
      code: getKeyCode('s')
    },
    commandId: 'Comfy.SaveWorkflow'
  },
  {
    combo: {
      key: 'o',
      ctrl: true,
      code: getKeyCode('o')
    },
    commandId: 'Comfy.OpenWorkflow'
  },
  {
    combo: {
      key: 'Backspace',
      code: getKeyCode('Backspace')
    },
    commandId: 'Comfy.ClearWorkflow'
  },
  {
    combo: {
      key: 'g',
      ctrl: true,
      code: getKeyCode('g')
    },
    commandId: 'Comfy.Graph.GroupSelectedNodes'
  },
  {
    combo: {
      key: ',',
      ctrl: true,
      code: getKeyCode(',')
    },
    commandId: 'Comfy.ShowSettingsDialog'
  },
  // For '=' both holding shift and not holding shift
  {
    combo: {
      key: '=',
      alt: true,
      code: getKeyCode('=')
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '+',
      alt: true,
      shift: true,
      code: getKeyCode('+')
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  // For number pad '+'
  {
    combo: {
      key: '+',
      alt: true,
      code: getKeyCode('+')
    },
    commandId: 'Comfy.Canvas.ZoomIn',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '-',
      alt: true,
      code: getKeyCode('-')
    },
    commandId: 'Comfy.Canvas.ZoomOut',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '.',
      code: getKeyCode('.')
    },
    commandId: 'Comfy.Canvas.FitView',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'p',
      code: getKeyCode('p')
    },
    commandId: 'Comfy.Canvas.ToggleSelected.Pin',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'c',
      alt: true,
      code: getKeyCode('c')
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'b',
      ctrl: true,
      code: getKeyCode('b')
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: 'm',
      ctrl: true,
      code: getKeyCode('m')
    },
    commandId: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
    targetElementId: 'graph-canvas'
  },
  {
    combo: {
      key: '`',
      ctrl: true,
      code: getKeyCode('`')
    },
    commandId: 'Workspace.ToggleBottomPanelTab.logs-terminal'
  },
  {
    combo: {
      key: 'f',
      code: getKeyCode('f')
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
  }
]
