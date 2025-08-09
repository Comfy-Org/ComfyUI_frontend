export const CORE_MENU_COMMANDS = [
  [[], ['Comfy.NewBlankWorkflow']],
  [[], []], // Separator after New
  [['File'], ['Comfy.OpenWorkflow']],
  [
    ['File'],
    [
      'Comfy.SaveWorkflow',
      'Comfy.SaveWorkflowAs',
      'Comfy.ExportWorkflow',
      'Comfy.ExportWorkflowAPI'
    ]
  ],
  [['Edit'], ['Comfy.Undo', 'Comfy.Redo']],
  [['Edit'], ['Comfy.OpenClipspace']],
  [
    ['Help'],
    [
      'Comfy.Help.OpenComfyUIIssues',
      'Comfy.Help.OpenComfyUIDocs',
      'Comfy.Help.OpenComfyOrgDiscord',
      'Comfy.Help.OpenComfyUIForum'
    ]
  ],
  [
    ['Help'],
    ['Comfy.Help.AboutComfyUI', 'Comfy.Feedback', 'Comfy.ContactSupport']
  ]
]
