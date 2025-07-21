export const CORE_MENU_COMMANDS = [
  [['Workflow'], ['Comfy.NewBlankWorkflow']],
  [['Workflow'], ['Comfy.OpenWorkflow', 'Comfy.BrowseTemplates']],
  [
    ['Workflow'],
    [
      'Comfy.SaveWorkflow',
      'Comfy.SaveWorkflowAs',
      'Comfy.ExportWorkflow',
      'Comfy.ExportWorkflowAPI'
    ]
  ],
  [['Edit'], ['Comfy.Undo', 'Comfy.Redo']],
  [
    ['Edit'],
    [
      'Comfy.RefreshNodeDefinitions',
      'Comfy.Memory.UnloadModels',
      'Comfy.Memory.UnloadModelsAndExecutionCache'
    ]
  ],
  [['Edit'], ['Comfy.ClearWorkflow']],
  [['Edit'], ['Comfy.OpenClipspace']],
  [['Manager'], ['Comfy.Manager.CustomNodesManager.ShowCustomNodesMenu']],
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
