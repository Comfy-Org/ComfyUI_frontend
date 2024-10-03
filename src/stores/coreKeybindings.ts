import type { Keybinding } from '@/types/keyBindingTypes'

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
    commandId: 'Comfy.ToggleQueueSidebarTab'
  },
  {
    combo: {
      key: 'h'
    },
    commandId: 'Comfy.ToggleQueueSidebarTab'
  },
  {
    combo: {
      key: 's',
      ctrl: true
    },
    commandId: 'Comfy.ExportWorkflow'
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
      key: 'd',
      ctrl: true
    },
    commandId: 'Comfy.LoadDefaultWorkflow'
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
  }
]
