// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import TaskTile from './TaskTile.vue'

describe('TaskTile', () => {
  it('links the full tile and renders its destination-owned image', () => {
    render(TaskTile, {
      props: {
        href: 'https://comfy.org/workflows/use-cases/ai-image-upscaler/',
        title: 'AI upscaler',
        description: 'Detail without artifacts.',
        meta: '8 models',
        mediaSrc: 'https://comfy-hub-assets.comfy.org/example.png'
      }
    })

    expect(
      screen.getByRole('link', { name: /AI upscaler/ }).getAttribute('href')
    ).toBe('https://comfy.org/workflows/use-cases/ai-image-upscaler/')
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      'https://comfy-hub-assets.comfy.org/example.png'
    )
  })
})
