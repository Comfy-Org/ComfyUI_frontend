import { fromPartial } from '@total-typescript/shoehorn'
import { expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { reportError } from '@comfyorg/telemetry/reportError'

import { legacyVhsUnbatchWarningExtension as extension } from './legacyVhsUnbatchWarning'

vi.mock(import('@comfyorg/telemetry/reportError'))

function register(nodeData: Partial<ComfyNodeDef>) {
  return extension.beforeRegisterNodeDef?.(
    fromPartial<typeof LGraphNode>({}),
    fromPartial<ComfyNodeDef>(nodeData),
    fromPartial<ComfyApp>({})
  )
}

it('warns once, only for the pre-MatchType VHS Unbatch definition', async () => {
  await register({ name: 'VHS_Unbatch', output: ['COMFY_MATCHTYPE_V3'] })
  await register({ name: 'PreviewAny', output: ['*'] })
  expect(useToast().toasts).toEqual([])
  expect(reportError).not.toHaveBeenCalled()

  await register({ name: 'VHS_Unbatch', output: ['*'] })
  await register({ name: 'VHS_Unbatch', output: ['*'] })

  expect(useToast().toasts).toMatchObject([
    {
      kind: 'warning',
      title: 'Update ComfyUI-VideoHelperSuite',
      description: expect.stringContaining('Update it from the Manager')
    }
  ])
  expect(reportError).toHaveBeenCalledOnce()
  expect(reportError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      errorType: 'deprecated_extension_graph_patch',
      level: 'warning',
      tags: { extension: 'VideoHelperSuite' }
    })
  )
})
