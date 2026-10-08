/* oxlint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'
import ProductShowcaseSection from './ProductShowcaseSection.vue'

const AGENT_VIDEO =
  'https://media.comfy.org/website/comfy-agent/homepage-agent-cut-03.mp4'
const API_VIDEO =
  'https://media.comfy.org/website/comfy-api/homepage-api-cut-04.mp4'

// The scene players are covered by their own suites; here only the slide
// wiring matters.
function renderSection() {
  return render(ProductShowcaseSection, {
    global: { stubs: { LottieScene: true, VideoPlayer: true } }
  })
}

function sceneSources(): (string | null)[] {
  return [
    ...document.querySelectorAll('lottie-scene-stub, video-player-stub')
  ].map((el) => el.getAttribute('src'))
}

describe('ProductShowcaseSection', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  it('mounts the node scene on desktop plus a mobile copy of it', () => {
    renderSection()

    // Only the first feature is a scene; the video tabs stay unmounted until
    // selected, so an idle tab never loads its video.
    expect(sceneSources()).toEqual([
      '/animations/scene-1/scene-01.json',
      '/animations/scene-1/scene-01.json'
    ])
  })

  it('titles the tabs Comfy Agent and Comfy API after Full Control with Nodes', () => {
    renderSection()

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(['Full Control with Nodes', 'Comfy Agent', 'Comfy API'])
    expect(screen.queryByText(/App mode|Community Workflows/i)).toBeNull()
  })

  it.for([
    ['Full Control with Nodes', '/download/', 'Explore Comfy Desktop'],
    ['Comfy Agent', '/agent/', 'Explore Comfy Agent'],
    ['Comfy API', '/platform/comfy-api/', 'Explore Comfy API']
  ])(
    'links the selected %s card to its product page',
    async ([name, href, cta]) => {
      renderSection()

      screen.getByRole('heading', { name }).click()
      await nextTick()

      const link = screen.getByRole('link', { name: new RegExp(name) })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveTextContent(cta)
    }
  )

  it.for([
    ['Comfy Agent', AGENT_VIDEO],
    ['Comfy API', API_VIDEO]
  ])(
    'plays the %s demo on desktop and mobile once selected',
    async ([name, src]) => {
      renderSection()

      screen.getByRole('heading', { name }).click()
      await nextTick()

      expect(sceneSources().filter((s) => s === src)).toHaveLength(2)
      expect(
        sceneSources().filter((s) => s === '/animations/scene-1/scene-01.json')
      ).toHaveLength(1)
    }
  )

  it.for(['Comfy Agent', 'Comfy API'])(
    'keeps the %s demo free of playback controls',
    async (name) => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      render(ProductShowcaseSection, {
        global: { stubs: { LottieScene: true } }
      })

      screen.getByRole('heading', { name }).click()
      await nextTick()

      expect(
        screen.queryByRole('button', {
          name: /^(Play|Pause|Mute|Unmute)$/
        })
      ).toBeNull()
      expect(screen.queryByTestId('player-control-bar')).toBeNull()
    }
  )
})
