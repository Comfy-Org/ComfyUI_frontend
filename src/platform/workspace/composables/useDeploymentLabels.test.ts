import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import { render } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

import {
  useBootDeploymentFullLabel,
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
      title: 'Studio Build',
      subtitle: 'production',
      full: 'Studio Build · production'
    },
    {
      name: 'unnamed',
      fields: {},
      title: 'Studio Build',
      subtitle: 'dep-12345678',
      full: 'Studio Build · dep-12345678'
    },
    {
      name: 'empty name',
      fields: { deployment_name: '' },
      title: 'Studio Build',
      subtitle: 'dep-12345678',
      full: 'Studio Build · dep-12345678'
    },
    {
      name: 'named without Build',
      fields: { deployment_name: 'staging', build_name: undefined },
      title: 'staging',
      subtitle: null,
      full: 'staging'
    },
    {
      name: 'unnamed without Build',
      fields: { build_name: undefined },
      title: 'Deployment dep-12345678',
      subtitle: null,
      full: 'Deployment dep-12345678'
    },
    {
      name: 'punctuation',
      fields: {
        deployment_name: "Studio's R&D/Prod",
        build_name: "Artist's R&D"
      },
      title: "Artist's R&D",
      subtitle: "Studio's R&D/Prod",
      full: "Artist's R&D · Studio's R&D/Prod"
    }
  ] satisfies {
    name: string
    fields: Partial<WorkspaceDeployment>
    title: string
    subtitle: string | null
    full: string
  }[])(
    'names a $name deployment by its Build first',
    ({ fields, title, subtitle, full }) => {
      const labels = mountLabels()
      const row = { ...deployment, ...fields }
      expect(labels.deploymentTitle(row)).toBe(title)
      expect(labels.deploymentSubtitle(row)).toBe(subtitle)
      expect(labels.deploymentFullLabel(row)).toBe(full)
    }
  )

  it.for([
    { status: 'ready', fields: {}, meta: 'v2' },
    { status: 'ready', fields: { release_version: undefined }, meta: null },
    { status: 'stopped', fields: {}, meta: 'Stopped' },
    { status: 'provisioning', fields: {}, meta: 'Starting' },
    { status: 'draining', fields: {}, meta: 'draining' }
  ] satisfies {
    status: string
    fields: Partial<WorkspaceDeployment>
    meta: string | null
  }[])(
    'reads $meta beside a $status deployment',
    ({ status, fields, meta }) => {
      const labels = mountLabels()
      expect(labels.deploymentMeta({ ...deployment, ...fields, status })).toBe(
        meta
      )
    }
  )

  it('follows a listing refresh for the current and default names while the boot labels keep the deployment the page booted on', () => {
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
    const bootFullLabel = useBootDeploymentFullLabel()
    expect(labels.currentTitle.value).toBe('Studio Build')
    expect(labels.currentLabel.value).toBe('Studio Build · production')
    expect(labels.defaultName.value).toBe('production')
    expect(bootLabel.value).toBe('production')
    expect(bootFullLabel.value).toBe('Studio Build · production')

    const renamed = { ...named, deployment_name: 'Studio production' }
    store.state = { ...store.state, deployments: [renamed] }
    expect(labels.currentLabel.value).toBe('Studio Build · Studio production')
    expect(labels.defaultName.value).toBe('Studio production')
    expect(bootFullLabel.value).toBe('Studio Build · production')
  })

  it('says Comfy Cloud for a page that booted on no deployment', () => {
    useDeploymentPickStore().bootDeployment = null
    expect(useBootDeploymentFullLabel().value).toBe('Comfy Cloud')
  })
})
