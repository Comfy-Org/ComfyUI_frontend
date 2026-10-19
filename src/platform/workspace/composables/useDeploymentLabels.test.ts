import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import { render } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

import {
  useBootDeploymentLabel,
  useDeploymentLabels
} from './useDeploymentLabels'

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-12345678-0000-4000-8000-000000000001',
  release_id: 'release-2',
  build_name: 'Studio Build',
  release_version: 2,
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
}

function mountLabels() {
  let labels: ReturnType<typeof useDeploymentLabels> | undefined
  render(
    {
      setup() {
        labels = useDeploymentLabels()
      },
      template: '<div />'
    },
    {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            escapeParameter: true,
            messages: { en: enMessages }
          })
        ]
      }
    }
  )
  assert.exists(labels)
  return labels
}

describe('deployment labels', () => {
  it.for([
    {
      name: 'named',
      fields: { deployment_name: 'production' },
      title: 'production',
      caption: 'Studio Build v2 · dep-12345678, ready'
    },
    {
      name: 'unnamed',
      fields: {},
      title: 'Studio Build v2',
      caption: 'dep-12345678, ready'
    },
    {
      name: 'empty name',
      fields: { deployment_name: '' },
      title: 'Studio Build v2',
      caption: 'dep-12345678, ready'
    },
    {
      name: 'named without Build',
      fields: { deployment_name: 'staging', build_name: undefined },
      title: 'staging',
      caption: 'dep-12345678, ready'
    },
    {
      name: 'named without Release version',
      fields: { deployment_name: 'staging', release_version: undefined },
      title: 'staging',
      caption: 'dep-12345678, ready'
    },
    {
      name: 'unnamed without Build',
      fields: { build_name: undefined },
      title: 'Deployment dep-12345678',
      caption: 'dep-12345678, ready'
    },
    {
      name: 'punctuation',
      fields: {
        deployment_name: "Studio's R&D/Prod",
        build_name: "Artist's R&D"
      },
      title: "Studio's R&D/Prod",
      caption: "Artist's R&D v2 · dep-12345678, ready"
    }
  ] satisfies {
    name: string
    fields: Partial<WorkspaceDeployment>
    title: string
    caption: string
  }[])('labels a $name deployment', ({ fields, title, caption }) => {
    const labels = mountLabels()
    const row = { ...deployment, ...fields }
    expect(labels.deploymentLabel(row)).toBe(title)
    expect(labels.deploymentCaption(row)).toBe(caption)
  })

  it('updates current and default names after a listing refresh while the boot label keeps its original deployment', () => {
    const store = useDeploymentPickStore()
    const named = { ...deployment, deployment_name: 'production' }
    store.state = {
      phase: 'ready',
      deployments: [named],
      pickedDeploymentId: deployment.deployment_id,
      pickSource: 'workspace_default',
      defaultDeploymentId: deployment.deployment_id,
      gonePickedDeploymentId: null,
      goneDefaultDeploymentId: null,
      buildsVisible: true
    }
    store.bootDeployment = named
    const labels = mountLabels()
    const bootLabel = useBootDeploymentLabel()
    expect(labels.currentLabel.value).toBe('production')
    expect(labels.defaultLabel.value).toBe('production')
    expect(bootLabel.value).toBe('production')
    expect(labels.deploymentCaption(named)).toBe(
      'Studio Build v2 · dep-12345678, ready · Workspace default'
    )

    const renamed = { ...named, deployment_name: 'Studio production' }
    store.state = { ...store.state, deployments: [renamed] }
    expect(labels.currentLabel.value).toBe('Studio production')
    expect(labels.defaultLabel.value).toBe('Studio production')
    expect(labels.deploymentCaption(renamed)).toBe(
      'Studio Build v2 · dep-12345678, ready · Workspace default'
    )

    const updated = { ...renamed, release_id: 'release-3', release_version: 3 }
    store.state = { ...store.state, deployments: [updated] }
    expect(labels.currentLabel.value).toBe('Studio production')
    expect(labels.deploymentCaption(updated)).toBe(
      'Studio Build v3 · dep-12345678, ready · Workspace default'
    )
    expect(bootLabel.value).toBe('production')
  })
})
