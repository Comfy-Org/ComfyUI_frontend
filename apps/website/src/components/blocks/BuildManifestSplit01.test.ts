// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import BuildManifestSplit01 from './BuildManifestSplit01.vue'

type BuildManifestProps = ComponentProps<typeof BuildManifestSplit01>

const requiredProps = {
  eyebrow: 'COMFYUI MANAGED BUILDS',
  heading: 'Govern the fleet',
  body: 'Ship one approved environment wherever the work happens.',
  primaryCta: { label: 'REQUEST DEMO', href: '/contact/' },
  manifestLabel: 'APPROVED BUILD',
  manifestName: 'Production environment',
  manifestVersion: 'CURRENT',
  manifestItems: [
    { id: 'dependencies', label: 'Dependencies', value: 'Pinned' }
  ]
} satisfies BuildManifestProps

function renderManifest(props: Partial<BuildManifestProps> = {}) {
  return render(BuildManifestSplit01, {
    props: { ...requiredProps, ...props }
  })
}

describe('BuildManifestSplit01', () => {
  it('renders a complete governed build with resolved CTA relationships', () => {
    renderManifest({
      headingTag: 'h1',
      features: ['Private models', 'Allowlisted custom nodes'],
      primaryCta: {
        label: 'REQUEST DEMO',
        href: '/contact/',
        target: '_blank',
        rel: 'nofollow'
      },
      secondaryCta: {
        label: 'READ DETAILS',
        href: 'https://docs.comfy.org/',
        target: '_blank'
      },
      manifestItems: [
        { id: 'dependencies', label: 'Dependencies', value: 'Pinned' },
        { id: 'models', label: 'Models', value: 'Approved and private' }
      ],
      releaseLabels: [
        { id: 'previous', label: 'Previous release' },
        { id: 'current', label: 'Current release', current: true }
      ],
      deploymentTargets: [
        { id: 'workstations', label: 'Workstations' },
        { id: 'servers', label: 'GPU servers' }
      ]
    })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Govern the fleet' })
    ).toBeTruthy()
    expect(screen.getByText('COMFYUI MANAGED BUILDS')).toBeTruthy()
    expect(
      screen.getByText(
        'Ship one approved environment wherever the work happens.'
      )
    ).toBeTruthy()
    expect(screen.getByText('Private models')).toBeTruthy()
    expect(screen.getByText('Allowlisted custom nodes')).toBeTruthy()
    expect(screen.getByText('APPROVED BUILD')).toBeTruthy()
    expect(screen.getByText('Production environment')).toBeTruthy()
    expect(screen.getByText('CURRENT')).toBeTruthy()
    expect(screen.getByText('Dependencies')).toBeTruthy()
    expect(screen.getByText('Pinned')).toBeTruthy()
    expect(screen.getByText('Models')).toBeTruthy()
    expect(screen.getByText('Approved and private')).toBeTruthy()

    const releases = screen.getByLabelText('Build releases')
    expect(within(releases).getByText('Previous release')).toBeTruthy()
    expect(within(releases).getByText('Current release')).toBeTruthy()

    const targets = screen.getByLabelText('Deployment targets')
    expect(within(targets).getByText('Workstations')).toBeTruthy()
    expect(within(targets).getByText('GPU servers')).toBeTruthy()

    const primaryCta = screen.getByRole('link', { name: 'REQUEST DEMO' })
    expect(primaryCta.getAttribute('href')).toBe('/contact/')
    expect(primaryCta.getAttribute('target')).toBe('_blank')
    expect(primaryCta.getAttribute('rel')).toBe('nofollow')

    const secondaryCta = screen.getByRole('link', { name: 'READ DETAILS' })
    expect(secondaryCta.getAttribute('href')).toBe('https://docs.comfy.org/')
    expect(secondaryCta.getAttribute('target')).toBe('_blank')
    expect(secondaryCta.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('uses an h2 and omits optional groups by default', () => {
    renderManifest()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Govern the fleet' })
    ).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('link', { name: 'READ DETAILS' })).toBeNull()
    expect(screen.queryByLabelText('Build releases')).toBeNull()
    expect(screen.queryByLabelText('Deployment targets')).toBeNull()
    const primaryCta = screen.getByRole('link', { name: 'REQUEST DEMO' })
    expect(primaryCta.getAttribute('rel')).toBeNull()
  })
})
