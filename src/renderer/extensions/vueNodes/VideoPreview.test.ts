import { getActivePinia } from 'pinia'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import { useTelemetry } from '@comfyorg/telemetry'

import { downloadFile } from '@/base/common/downloadUtil'
import { resetImageFailureProbesForTest } from '@/platform/telemetry/imageFailureDiagnostics'
import VideoPreview from '@/renderer/extensions/vueNodes/VideoPreview.vue'
import type { AugmentedResultItem } from '@/utils/resultItem'

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
        loading: 'Loading'
      }
    }
  }
})

function videoOutput(filename: string): AugmentedResultItem {
  return {
    filename,
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType: 'video'
  }
}

describe('VideoPreview', () => {
  const defaultProps: ComponentProps<typeof VideoPreview> = {
    items: [videoOutput('test1.mp4'), videoOutput('test2.mp4')]
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

  describe('stored preview', () => {
    it('plays the stored preview of a video but downloads the original file', async () => {
      renderVideoPreview({
        items: [{ ...videoOutput('render.mov'), preview_id: 'proxy-1' }]
      })
      const user = userEvent.setup()

      expect(screen.getByTestId('main-video')).toHaveAttribute(
        'src',
        '/api/assets/proxy-1/content?disposition=inline'
      )

      await user.hover(screen.getByRole('region'))
      await user.click(screen.getByRole('button', { name: 'Download video' }))

      expect(downloadFile).toHaveBeenCalledExactlyOnceWith(
        '/api/view?filename=render.mov&type=output&subfolder=',
        'render.mov',
        'node_preview'
      )
    })
  })

  describe('load failure telemetry', () => {
    it('reports the media error code from the video element', async () => {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 200 })
      )
      renderVideoPreview({
        items: [videoOutput('prores.mov')]
      })
      const video = screen.getByTestId('main-video')
      Object.defineProperty(video, 'error', {
        configurable: true,
        get: () => ({ code: 4 })
      })

      await fireEvent.error(video)

      await vi.waitFor(() =>
        expect(
          useTelemetry()?.trackImageLoadFailed
        ).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            source: 'node_video_preview',
            media_error_code: 4
          })
        )
      )
    })

    it('reports a failed video load once, attributed to the Vue node preview', async () => {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 404 })
      )
      renderVideoPreview({ items: [videoOutput('broken.mp4')] })

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

  describe('stalled load', () => {
    const videoRegion = () =>
      screen.getByRole('region', { name: /Video preview/ })

    it('brings the loader down and reports a stall when neither loadeddata nor error arrives', async () => {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 200 })
      )
      renderVideoPreview({
        items: [videoOutput('stalled.mp4')]
      })

      expect(videoRegion()).toHaveAttribute('aria-busy', 'true')

      await vi.advanceTimersByTimeAsync(8192)
      await nextTick()

      expect(videoRegion()).toHaveAttribute('aria-busy', 'false')
      expect(screen.getByTestId('main-video')).toBeInTheDocument()
      expect(
        screen.queryByTestId('error-loading-video')
      ).not.toBeInTheDocument()

      await vi.waitFor(() =>
        expect(
          useTelemetry()?.trackImageLoadFailed
        ).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            source: 'node_video_preview',
            timed_out: true,
            attempts: 1,
            resource_kind: 'output',
            status: 200
          })
        )
      )
    })

    it('does not report a load that completes before the timeout', async () => {
      resetImageFailureProbesForTest()
      renderVideoPreview({
        items: [videoOutput('fine.mp4')]
      })

      await fireEvent.loadedData(screen.getByTestId('main-video'))
      await nextTick()
      await vi.advanceTimersByTimeAsync(8192 * 2)

      expect(videoRegion()).toHaveAttribute('aria-busy', 'false')
      expect(useTelemetry()?.trackImageLoadFailed).not.toHaveBeenCalled()
    })

    it('reveals without reporting when the browser stopped after metadata', async () => {
      resetImageFailureProbesForTest()
      renderVideoPreview({
        items: [videoOutput('suspended.mp4')]
      })
      const video = screen.getByTestId('main-video')
      Object.defineProperty(video, 'readyState', {
        configurable: true,
        get: () => 1
      })

      await vi.advanceTimersByTimeAsync(8192)
      await nextTick()

      expect(videoRegion()).toHaveAttribute('aria-busy', 'false')
      expect(useTelemetry()?.trackImageLoadFailed).not.toHaveBeenCalled()
    })

    it('gives a newly selected video its own full timeout', async () => {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 200 })
      )
      renderVideoPreview()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await vi.advanceTimersByTimeAsync(8000)
      await user.click(
        screen.getByRole('button', { name: 'View video 2 of 2' })
      )
      await vi.advanceTimersByTimeAsync(8000)
      await nextTick()

      expect(videoRegion()).toHaveAttribute('aria-busy', 'true')
      expect(useTelemetry()?.trackImageLoadFailed).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(192)
      await nextTick()

      expect(videoRegion()).toHaveAttribute('aria-busy', 'false')
      await vi.waitFor(() =>
        expect(
          useTelemetry()?.trackImageLoadFailed
        ).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            timed_out: true,
            resource_kind: 'output'
          })
        )
      )
    })

    it('does not report the same load again when it errors after a stall', async () => {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 200 })
      )
      renderVideoPreview({
        items: [videoOutput('late-error.mp4')]
      })

      await vi.advanceTimersByTimeAsync(8192)
      await nextTick()
      await vi.waitFor(() =>
        expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalledOnce()
      )

      await fireEvent.error(screen.getByTestId('main-video'))
      await nextTick()
      await vi.advanceTimersByTimeAsync(0)

      expect(screen.getByTestId('error-loading-video')).toBeInTheDocument()
      expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalledOnce()
    })
    it('reports an error from a recreated element for the same URL after a stall', async () => {
      resetImageFailureProbesForTest()
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 200 })
      )
      const sameVideo = videoOutput('twice.mp4')
      renderVideoPreview({ items: [sameVideo, sameVideo] })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await vi.advanceTimersByTimeAsync(8192)
      await nextTick()
      await fireEvent.error(screen.getByTestId('main-video'))
      await vi.waitFor(() =>
        expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalledOnce()
      )

      await user.click(
        screen.getByRole('button', { name: 'View video 2 of 2' })
      )
      await fireEvent.error(screen.getByTestId('main-video'))

      await vi.waitFor(() =>
        expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalledTimes(2)
      )
    })
  })

  describe('batch cycling with identical URLs', () => {
    it('should not enter persistent loading state when cycling through identical videos', async () => {
      const sameVideo = videoOutput('test.mp4')
      const { container } = renderVideoPreview({
        items: [sameVideo, sameVideo, sameVideo]
      })
      const user = userEvent.setup()

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const videoEl = container.querySelector('video')
      expect(videoEl).not.toBeNull()
      await fireEvent.loadedData(videoEl!)
      await nextTick()
      expect(
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()

      const dots = screen.getAllByRole('button', { name: /^View video/ })
      await user.click(dots[1])
      await nextTick()

      expect(
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()
    })

    it('should show loader when cycling to a different URL', async () => {
      const { container } = renderVideoPreview({
        items: [videoOutput('a.mp4'), videoOutput('b.mp4')]
      })
      const user = userEvent.setup()

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const videoEl = container.querySelector('video')
      expect(videoEl).not.toBeNull()
      await fireEvent.loadedData(videoEl!)
      await nextTick()
      expect(
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()

      const dots = screen.getAllByRole('button', { name: /^View video/ })
      await user.click(dots[1])
      await nextTick()

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    })
  })
})
