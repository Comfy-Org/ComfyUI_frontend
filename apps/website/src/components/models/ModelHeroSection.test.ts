// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelHeroSection from './ModelHeroSection.vue'

describe('ModelHeroSection', () => {
  it('routes generated model pages to workflows without a download action', () => {
    render(ModelHeroSection, {
      props: {
        displayName: 'Wan Dancer',
        workflowCount: 1,
        directory: 'diffusion_models'
      }
    })

    expect(screen.getByRole('link', { name: 'RUN ON CLOUD' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'DOWNLOAD MODEL' })).toBeNull()
  })

  it('features the first workflow beside the model summary', () => {
    render(ModelHeroSection, {
      props: {
        displayName: 'Wan Dancer',
        workflowCount: 1,
        directory: 'diffusion_models',
        featuredWorkflow: {
          id: 'wan-dancer',
          title: 'Wan Dancer: Music to Dance',
          href: 'https://comfy.org/workflows/',
          sourceLabel: 'ComfyUI',
          media: { type: 'placeholder', alt: '' },
          tags: ['Video']
        }
      }
    })

    expect(
      screen.getByRole('link', { name: 'Wan Dancer: Music to Dance' })
    ).toBeTruthy()
  })
})
