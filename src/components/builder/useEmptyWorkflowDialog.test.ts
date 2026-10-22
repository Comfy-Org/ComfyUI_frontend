import { assert, describe, expect, it, vi } from 'vitest'

import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'

import { useEmptyWorkflowDialog } from './useEmptyWorkflowDialog'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/services/dialogService'))

vi.mock(import('@/composables/useWorkflowTemplateSelectorDialog'), () => {
  const templateSelectorDialog = { show: vi.fn(), hide: vi.fn() }
  return {
    useWorkflowTemplateSelectorDialog: () => templateSelectorDialog
  }
})

function showDialog() {
  const options = { onEnterBuilder: vi.fn(), onDismiss: vi.fn() }
  useEmptyWorkflowDialog().show(options)
  const [{ props }] = vi.mocked(useDialogService().showLayoutDialog).mock
    .calls[0]
  assert('onBackToWorkflow' in props && 'onLoadTemplate' in props)
  const { onBackToWorkflow, onLoadTemplate } = props
  assert(typeof onBackToWorkflow === 'function')
  assert(typeof onLoadTemplate === 'function')
  return { options, onBackToWorkflow, onLoadTemplate }
}

function closeTemplateSelector() {
  const [, templateOptions] = vi.mocked(
    useWorkflowTemplateSelectorDialog().show
  ).mock.calls[0]
  templateOptions?.afterClose?.()
}

describe('useEmptyWorkflowDialog', () => {
  it('dismisses when the user goes back to the workflow', () => {
    const { options, onBackToWorkflow } = showDialog()

    onBackToWorkflow()

    expect(options.onDismiss).toHaveBeenCalledOnce()
    expect(options.onEnterBuilder).not.toHaveBeenCalled()
  })

  it('enters the builder once a loaded template has populated the graph', () => {
    const { options, onLoadTemplate } = showDialog()

    onLoadTemplate()
    app.rootGraph.add(new LGraphNode('Loaded'))
    closeTemplateSelector()

    expect(options.onEnterBuilder).toHaveBeenCalledOnce()
  })

  it('stays out of the builder when the template selector closes on an empty graph', () => {
    const { options, onLoadTemplate } = showDialog()

    onLoadTemplate()
    closeTemplateSelector()

    expect(options.onEnterBuilder).not.toHaveBeenCalled()
  })
})
