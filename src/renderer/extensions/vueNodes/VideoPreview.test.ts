import { getActivePinia } from 'pinia'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import { useTelemetry } from '@comfyorg/telemetry'

import { resetImageFailureProbesForTest } from '@/platform/telemetry/imageFailureDiagnostics'
import VideoPreview from '@/renderer/extensions/vueNodes/VideoPreview.vue'

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadFile: vi.fn()
}))

vi.mock(import('@comfyorg/telemetry'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        downloadVideo: 'Download video',
        removeVideo: 'Remove video',
        viewVideoOfTotal: 'View video {index} of {total}',
        videoPreview:
          'Video preview - Use arrow keys to navigate between videos',
        errorLoadingVideo: 'Error loading video',
        failedToDownloadVideo: 'Failed to download video',
        calculatingDimensions: 'Calculating dimensions',
        videoFailedToLoad: 'Video failed to load',
        videoFormatNotSupported: "Your browser can't play this video format",
        videoSavedDownloadToView: 'The file was saved. Download it to view it.',
        loading: 'Loading'
      }
    }
  }
})

describe('VideoPreview', () => {
  const defaultProps: ComponentProps<typeof VideoPreview> = {
    imageUrls: [
      '/api/view?filename=test1.mp4&type=output',
      '/api/view?filename=test2.mp4&type=output'
    ]
  }

  function renderVideoPreview(
    props: Partial<ComponentProps<typeof VideoPreview>> = {}
  ) {
    return render(VideoPreview, {
      props: { ...defaultProps, ...props } as ComponentProps<
        typeof VideoPreview
      >,
      global: {
        plugins: [getActivePinia()!, i18n]
      }
    })
  }

  describe('load failure telemetry', () => {
    it('reports a failed video load once, attributed to the Vue node preview', async () => {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 404 })
      )
      renderVideoPreview({
        imageUrls: ['/api/view?filename=broken.mp4&type=output']
      })

      await fireEvent.error(screen.getByTestId('main-video'))
      await nextTick()

      expect(screen.getByTestId('error-loading-video')).toBeInTheDocument()
      await vi.waitFor(() =>
        expect(
          useTelemetry()?.trackImageLoadFailed
        ).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            source: 'node_video_preview',
            resource_kind: 'output',
            probe_outcome: 'probed',
            status: 404,
            page_age_ms: expect.any(Number)
          })
        )
      )
    })
  })

  describe('load failure message', () => {
    async function failWith(status: number, code: number) {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status })
      )
      renderVideoPreview({
        imageUrls: ['/api/view?filename=clip.mov&type=output']
      })
      const video = screen.getByTestId('main-video')
      Object.defineProperty(video, 'error', { value: { code } })
      await fireEvent.error(video)
    }

    it('names the file of a relative /api/view URL instead of "Invalid URL"', async () => {
      await failWith(404, 4)

      expect(screen.getByText('clip.mov')).toBeInTheDocument()
      expect(screen.queryByText('Invalid URL')).not.toBeInTheDocument()
    })

    it('says the format is unplayable when the file is served but cannot be decoded', async () => {
      await failWith(206, 4)

      expect(
        await screen.findByText("Your browser can't play this video format")
      ).toBeInTheDocument()
      expect(screen.getByTestId('video-saved-hint')).toBeInTheDocument()
      expect(screen.queryByText('Video failed to load')).not.toBeInTheDocument()
    })

    it('keeps the generic message when the file itself is missing', async () => {
      await failWith(404, 4)
      await vi.waitFor(() =>
        expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalled()
      )

      expect(screen.getByText('Video failed to load')).toBeInTheDocument()
      expect(screen.queryByTestId('video-saved-hint')).not.toBeInTheDocument()
    })

    it('keeps the generic message for a network error on a served file', async () => {
      await failWith(206, 2)
      await vi.waitFor(() =>
        expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalled()
      )

      expect(screen.getByText('Video failed to load')).toBeInTheDocument()
      expect(screen.queryByTestId('video-saved-hint')).not.toBeInTheDocument()
    })
  })

  describe('batch cycling with identical URLs', () => {
    it('should not enter persistent loading state when cycling through identical videos', async () => {
      const sameUrl = '/api/view?filename=test.mp4&type=output'
      const { container } = renderVideoPreview({
        imageUrls: [sameUrl, sameUrl, sameUrl]
      })
      const user = userEvent.setup()

      // Simulate initial video load
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const videoEl = container.querySelector('video')
      expect(videoEl).not.toBeNull()
      await fireEvent.loadedData(videoEl!)
      await nextTick()
      expect(
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()

      // Click second navigation dot to cycle to identical URL
      const dots = screen.getAllByRole('button', { name: /^View video/ })
      await user.click(dots[1])
      await nextTick()

      // Should NOT be in loading state since URL didn't change
      expect(
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()
    })

    it('should show loader when cycling to a different URL', async () => {
      const { container } = renderVideoPreview({
        imageUrls: [
          '/api/view?filename=a.mp4&type=output',
          '/api/view?filename=b.mp4&type=output'
        ]
      })
      const user = userEvent.setup()

      // Simulate initial video load
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const videoEl = container.querySelector('video')
      expect(videoEl).not.toBeNull()
      await fireEvent.loadedData(videoEl!)
      await nextTick()
      expect(
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()

      // Click second dot — different URL
      const dots = screen.getAllByRole('button', { name: /^View video/ })
      await user.click(dots[1])
      await nextTick()

      // Should be in loading state since URL changed
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    })
  })
})
