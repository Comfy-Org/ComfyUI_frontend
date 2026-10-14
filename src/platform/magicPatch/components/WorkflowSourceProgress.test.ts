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
  it.for([
    'source_authentication_required',
    'source_access_denied',
    'source_service_unavailable',
    'source_connection_failed',
    'source_response_timeout',
    'source_response_invalid'
  ] as const)('shows the specific cause and action for %s', (reason) => {
    mount([{ pack, phase: 'error', reason }])
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.reasons[reason]
    )
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows a specific polling failure while preserving preparation instead of reporting completion', () => {
    mount([
      {
        pack,
        phase: 'preparing',
        deadline: 600000,
        disconnected: true,
        reason: 'source_service_unavailable',
        failure: { code: 'unavailable', status: 503 },
        acquisition: {
          acquisition_id: 'a'.repeat(32),
          state: 'acquiring',
          status_version: 2,
          source_ref: null,
          reason: null,
          conversion_supported: false,
          message: 'Acquiring',
          progress: {
            stage: 'source_preparation',
            state: 'acquiring',
            message: 'Acquiring'
          }
        }
      }
    ])
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.reasons.source_service_unavailable
    )
    expect(
      screen.getByText(en.magicPatch.resolvingWorkflowSource)
    ).toBeVisible()
  })

  it('does not render unrecognized server error text', () => {
    mount([{ pack, phase: 'error', reason: 'private-server-marker' }])
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.unavailable
    )
    expect(screen.queryByText('private-server-marker')).not.toBeInTheDocument()
  })

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
