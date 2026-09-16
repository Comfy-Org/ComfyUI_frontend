import { describe, expect, it } from 'vitest'

import { resolveReturnTarget } from './returnTargets'

describe('resolveReturnTarget', () => {
  it.for([
    ['comfyui_workspace', 'production', 'https://cloud.comfy.org/'],
    ['comfyui_workspace', 'staging', 'https://stagingcloud.comfy.org/'],
    ['comfyui_workspace', 'test', 'https://testcloud.comfy.org/'],
    [
      'comfyui_credits',
      'production',
      'https://cloud.comfy.org/?settings=plan-credits'
    ],
    [
      'comfyui_credits',
      'staging',
      'https://stagingcloud.comfy.org/?settings=plan-credits'
    ],
    [
      'comfyui_credits',
      'test',
      'https://testcloud.comfy.org/?settings=plan-credits'
    ],
    ['platform_account', 'production', 'https://platform.comfy.org/'],
    ['platform_account', 'staging', 'https://stagingplatform.comfy.org/']
  ] as const)('resolves %s in %s', ([target, environment, expected]) => {
    expect(resolveReturnTarget(target, environment)?.href).toBe(expected)
  })

  it.for([
    ['platform_account', 'test'],
    ['workshop_credits', 'production'],
    ['attacker_site', 'production'],
    ['https://attacker.example', 'production']
  ] as const)('leaves %s in %s unresolved', ([target, environment]) => {
    expect(resolveReturnTarget(target, environment)).toBeUndefined()
  })

  it('hands back a URL the caller may append to without editing the registry', () => {
    const first = resolveReturnTarget('comfyui_workspace', 'production')
    first?.searchParams.set('billing_result', 'success')

    expect(resolveReturnTarget('comfyui_workspace', 'production')?.href).toBe(
      'https://cloud.comfy.org/'
    )
  })
})
