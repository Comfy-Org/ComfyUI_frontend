import { describe, expect, it } from 'vitest'

import { isLegacyManagerQuery } from './legacyManagerQuery'

describe('isLegacyManagerQuery', () => {
  it.for([
    'comfyui-manager',
    'ComfyUI-Manager',
    '  comfyui-manager  ',
    'comfyui manager',
    'manager comfyui',
    'comfyui_manager',
    'ComfyUI  Manager',
    'manager_comfyui',
    'comfyui-manager-',
    '_comfyui_manager',
    'comfyui-manager.git',
    'comfyui-manager.GIT',
    'comfyui-manager/',
    'ltdrdata/ComfyUI-Manager/',
    'ltdrdata/ComfyUI-Manager//',
    'ltdrdata/ComfyUI-Manager /',
    'ltdrdata/comfyui_manager',
    'ltdrdata/ComfyUI-Manager',
    'Comfy-Org/comfyui-manager',
    'ltdrdata/comfyui-manager.git',
    'ltdrdata/ComfyUI-Manager.git /',
    'https://github.com/ltdrdata/ComfyUI-Manager',
    'https://github.com/Comfy-Org/ComfyUI-Manager.git',
    'github.com/ltdrdata/ComfyUI-Manager/tree/main'
  ])('matches %j', (query) => {
    expect(isLegacyManagerQuery(query)).toBe(true)
  })

  it.for([
    'willmiao/comfyui-lora-manager',
    'comfyui-lora-manager',
    'model-manager',
    'comfyui-model-manager',
    'workspace-manager',
    'comfyui-manager-extras',
    'comfyui_lora_manager',
    'model_manager.git',
    'willmiao/comfyui-lora-manager/',
    'willmiao/comfyui-lora-manager//',
    'where is comfyui-manager',
    'manager',
    'controlnet',
    '',
    '   '
  ])('does not match %j', (query) => {
    expect(isLegacyManagerQuery(query)).toBe(false)
  })
})
