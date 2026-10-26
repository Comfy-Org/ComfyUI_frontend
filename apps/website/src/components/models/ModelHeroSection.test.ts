import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelHeroSection from './ModelHeroSection.vue'

const file = {
  displayName: 'Qwen Image VAE',
  huggingFaceUrl: 'https://huggingface.co/Comfy-Org/qwen-image/vae.safetensors',
  docsUrl: 'https://docs.comfy.org/tutorials/qwen-image',
  hubSlug: 'qwen-image',
  workflowCount: 4,
  directory: 'vae'
}

function actions() {
  return screen.getAllByRole('link').map((link) => link.textContent.trim())
}

describe('ModelHeroSection', () => {
  it.for([
    {
      page: 'a Hub model file page',
      localFile: true,
      shown: ['Download for ComfyUI']
    },
    {
      page: 'a supported-model page',
      localFile: false,
      shown: ['TRY IN COMFY', 'DOWNLOAD MODEL', 'VIEW TUTORIAL']
    }
  ])('offers $shown on $page', ({ localFile, shown }) => {
    render(ModelHeroSection, { props: { ...file, localFile } })

    expect(actions()).toEqual(shown)
  })

  it('downloads the file itself from a Hub model file page', () => {
    render(ModelHeroSection, { props: { ...file, localFile: true } })

    expect(
      screen.getByRole('link', { name: 'Download for ComfyUI' })
    ).toHaveAttribute('href', file.huggingFaceUrl)
  })

  it('offers nothing to run on a Hub model file page without a download', () => {
    render(ModelHeroSection, {
      props: { ...file, huggingFaceUrl: '', localFile: true }
    })

    expect(screen.queryAllByRole('link')).toEqual([])
  })
})
