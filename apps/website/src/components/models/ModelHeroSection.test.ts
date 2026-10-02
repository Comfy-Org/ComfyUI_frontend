import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelHeroSection from './ModelHeroSection.vue'

const props = {
  displayName: 'Qwen Image 2.1 INT8 Convrot',
  huggingFaceUrl: 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1',
  thumbnailUrl: 'https://example.com/qwen.webp',
  workflowCount: 3,
  directory: 'diffusion_models'
}

describe('model detail hero', () => {
  it('shows the model name and its thumbnail alongside a workflow link', () => {
    render(ModelHeroSection, { props })
    expect(screen.getByRole('heading', { level: 1 }).textContent.trim()).toBe(
      props.displayName
    )
    expect(
      screen.getByRole('img', { name: props.displayName }).getAttribute('src')
    ).toBe(props.thumbnailUrl)
    const link = screen.getByRole('link', {
      name: '3 workflows use this model'
    })
    const url = new URL(link.getAttribute('href')!)
    expect(url.pathname).toBe('/workflows/')
    expect(screen.getByRole('link', { name: /download model/i })).toBeTruthy()
  })

  it('uses an existing model workflow page when one is configured', () => {
    render(ModelHeroSection, {
      props: { ...props, hubSlug: 'flux-1', thumbnailUrl: undefined }
    })
    expect(
      screen
        .getByRole('link', { name: '3 workflows use this model' })
        .getAttribute('href')
    ).toBe('https://comfy.org/workflows/model/flux-1/')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
