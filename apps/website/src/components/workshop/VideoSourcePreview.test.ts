import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import VideoSourcePreview from './VideoSourcePreview.vue'

it('waits until mounting before creating a local media URL', async () => {
  const create = vi.spyOn(URL, 'createObjectURL')
  const file = new File(['video'], 'source.mp4', { type: 'video/mp4' })
  const props = { file, name: 'Source video' }
  const html = await renderToString(
    createSSRApp({
      render: () => h(VideoSourcePreview, props)
    })
  )
  expect(create).not.toHaveBeenCalled()
  expect(html).not.toContain('blob:')
  render(VideoSourcePreview, { props })
  const video = await screen.findByTestId('video-source-thumbnail')
  expect(video.getAttribute('src')).toMatch(/^blob:/)
  expect(create).toHaveBeenCalledWith(file)
})

it('switches between remote examples and local uploads, revoking only its owned object URLs', async () => {
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValueOnce('blob:first')
    .mockReturnValueOnce('blob:second')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const props = {
    name: 'Input video',
    src: 'https://assets.example/source.mp4'
  }
  const { rerender, unmount } = render(VideoSourcePreview, { props })
  function video() {
    const element = screen.getByTestId('video-source-thumbnail')
    if (!(element instanceof HTMLVideoElement))
      throw new Error('Expected video')
    return element
  }
  expect(video().src).toBe(props.src)
  expect(video().preload).toBe('metadata')
  const first = new File(['one'], 'one.mp4', { type: 'video/mp4' })
  await rerender({ ...props, file: first })
  await waitFor(() => expect(video().src).toBe('blob:first'))
  expect(create).toHaveBeenCalledWith(first)
  await rerender({
    ...props,
    file: new File(['two'], 'two.mp4', { type: 'video/mp4' })
  })
  await waitFor(() => expect(video().src).toBe('blob:second'))
  expect(revoke).toHaveBeenCalledWith('blob:first')
  await rerender({ ...props, file: undefined })
  await waitFor(() => expect(video().src).toBe(props.src))
  expect(revoke).toHaveBeenCalledWith('blob:second')
  unmount()
  expect(revoke).not.toHaveBeenCalledWith(props.src)
})

it('opens a full video player with playback and scrubbing controls', async () => {
  render(VideoSourcePreview, {
    props: {
      name: 'Input video',
      src: 'https://assets.example/source.mp4'
    }
  })

  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Expand Input video' }))

  const dialog = await screen.findByTestId('video-source-dialog')
  const player = within(dialog).getByLabelText('Input video')
  if (!(player instanceof HTMLVideoElement))
    throw new Error('Expected video player')
  expect(player.controls).toBe(true)
  expect(player.muted).toBe(false)
  expect(player.src).toBe('https://assets.example/source.mp4')
})

it('localizes the expand and close controls', async () => {
  render(VideoSourcePreview, {
    props: {
      name: '输入视频',
      src: 'https://assets.example/source.mp4',
      locale: 'zh-CN'
    }
  })

  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: '放大 输入视频' }))

  const dialog = await screen.findByTestId('video-source-dialog')
  expect(within(dialog).getByRole('button', { name: '关闭' })).toBeTruthy()
})
