import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import { render } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

import {
  deploymentStatusTone,
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
  can_start: false,
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
      deploymentName: 'production',
      full: 'Studio Build · production'
    },
    {
      name: 'unnamed',
      fields: {},
      title: 'Studio Build',
      deploymentName: 'dep-12345678',
      full: 'Studio Build · dep-12345678'
    },
    {
      name: 'empty name',
      fields: { deployment_name: '' },
      title: 'Studio Build',
      deploymentName: 'dep-12345678',
      full: 'Studio Build · dep-12345678'
    },
    {
      name: 'named without Build',
      fields: { deployment_name: 'staging', build_name: undefined },
      title: 'staging',
      deploymentName: 'dep-12345678',
      full: 'staging · dep-12345678'
    },
    {
      name: 'unnamed without Build',
      fields: { build_name: undefined },
      title: 'Deployment dep-12345678',
      deploymentName: null,
      full: 'Deployment dep-12345678'
    },
    {
      name: 'punctuation',
      fields: {
        deployment_name: "Studio's R&D/Prod",
        build_name: "Artist's R&D"
      },
      title: "Artist's R&D",
      deploymentName: "Studio's R&D/Prod",
      full: "Artist's R&D · Studio's R&D/Prod"
    }
  ] satisfies {
    name: string
    fields: Partial<WorkspaceDeployment>
    title: string
    deploymentName: string | null
    full: string
  }[])(
    'names a $name deployment by its Build first, then its own name',
    ({ fields, title, deploymentName, full }) => {
      const labels = mountLabels()
      const row = { ...deployment, ...fields }
      expect(labels.deploymentRowLabels(row)).toMatchObject({
        title,
        name: deploymentName
      })
      expect(labels.deploymentFullLabel(row)).toBe(full)
    }
  )

  it.for([
    { status: 'ready', fields: {}, detail: 'v2' },
    { status: 'ready', fields: { release_version: undefined }, detail: null },
    { status: 'queued', fields: {}, detail: 'Starting' },
    { status: 'provisioning', fields: {}, detail: 'Starting' },
    { status: 'starting', fields: {}, detail: 'Starting' },
    { status: 'stopping', fields: {}, detail: 'Stopping' },
    { status: 'stopped', fields: {}, detail: 'Stopped' },
    { status: 'failed', fields: {}, detail: 'Failed' },
    { status: 'unhealthy', fields: {}, detail: 'Not ready' }
  ] satisfies {
    status: WorkspaceDeployment['status']
    fields: Partial<WorkspaceDeployment>
    detail: string | null
  }[])(
    'reads $detail in the column after the name of a $status deployment',
    ({ status, fields, detail }) => {
      const labels = mountLabels()
      expect(
        labels.deploymentRowLabels({ ...deployment, ...fields, status }).detail
      ).toBe(detail)
    }
  )

  it.for([
    {
      status: 'ready',
      fields: {},
      tooltip: 'Studio Build · production · v2'
    },
    {
      status: 'ready',
      fields: { release_version: undefined },
      tooltip: 'Studio Build · production'
    },
    {
      status: 'stopped',
      fields: {},
      tooltip: 'Studio Build · production · Stopped'
    }
  ] satisfies {
    status: WorkspaceDeployment['status']
    fields: Partial<WorkspaceDeployment>
    tooltip: string
  }[])(
    'spells out a $status row in full for the tooltip: $tooltip',
    ({ status, fields, tooltip }) => {
      const labels = mountLabels()
      expect(
        labels.deploymentRowLabels({
          ...deployment,
          deployment_name: 'production',
          ...fields,
          status
        }).tooltip
      ).toBe(tooltip)
    }
  )

  it('labels the Comfy Cloud row by its name alone', () => {
    expect(mountLabels().deploymentRowLabels(null)).toEqual({
      value: 'comfy-cloud',
      deploymentId: null,
      title: 'Comfy Cloud',
      name: null,
      detail: null,
      tooltip: 'Comfy Cloud'
    })
  })

  it.for([
    { status: 'ready', tone: 'ready' },
    { status: 'queued', tone: 'pending' },
    { status: 'starting', tone: 'pending' },
    { status: 'provisioning', tone: 'pending' },
    { status: 'failed', tone: 'failed' },
    { status: 'stopping', tone: 'stopped' },
    { status: 'stopped', tone: 'stopped' },
    { status: 'unhealthy', tone: 'stopped' }
  ] as const)(
    'gives a $status deployment the $tone dot',
    ({ status, tone }) => {
      expect(deploymentStatusTone(status)).toBe(tone)
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
    expect(labels.currentLabel.value).toBe('Studio Build · production')
    expect(labels.defaultTitle.value).toBe('Studio Build')
    expect(bootLabel.value).toBe('production')
    expect(bootFullLabel.value).toBe('Studio Build · production')

    const renamed = { ...named, deployment_name: 'Studio production' }
    store.state = { ...store.state, deployments: [renamed] }
    expect(labels.currentLabel.value).toBe('Studio Build · Studio production')
    expect(labels.defaultTitle.value).toBe('Studio Build')
    expect(bootFullLabel.value).toBe('Studio Build · production')
  })

  it.for([
    {
      booted: 'on no deployment',
      boot: null,
      refused: false,
      label: 'Comfy Cloud'
    },
    {
      booted: 'outside the rollout',
      boot: undefined,
      refused: true,
      label: 'Comfy Cloud'
    },
    {
      booted: 'before the listing answers',
      boot: undefined,
      refused: false,
      label: undefined
    }
  ] as const)(
    'names where a page booted $booted: $label',
    ({ boot, refused, label }) => {
      const store = useDeploymentPickStore()
      store.bootDeployment = boot
      store.listingRefused = refused
      expect(useBootDeploymentFullLabel().value).toBe(label)
    }
  )
})
