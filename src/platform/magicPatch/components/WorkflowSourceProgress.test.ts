import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en/main.json'
import type { WorkflowSourceJob } from '../stores/magicPatchBatchStore'
import WorkflowSourceProgress from './WorkflowSourceProgress.vue'

const pack = {
  key: 'power:2.0.0',
  name: 'z-image-power-nodes',
  version: '2.0.0',
  nodeTypes: ['SaveImage //ZImagePowerNodes']
}

function mount(jobs: WorkflowSourceJob[]) {
  return render(WorkflowSourceProgress, {
    props: { jobs },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

describe('workflow source preparation progress', () => {
  it('shows the actual pack and indeterminate progress while preparing source', () => {
    mount([{ pack, phase: 'resolving' }])
    expect(screen.getByText(pack.name)).toBeVisible()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')
    expect(
      screen.getByText(en.magicPatch.resolvingWorkflowSource)
    ).toBeVisible()
  })

  it('replaces progress with the failure reason instead of reporting completion', async () => {
    const view = mount([{ pack, phase: 'resolving' }])
    await view.rerender({
      jobs: [{ pack, phase: 'error', reason: 'registry_source_not_found' }]
    })
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.reasons.registry_source_not_found
    )
  })
})
