// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import MediaSourcePreview from './MediaSourcePreview.vue'

it('waits until mounting before creating a local media URL', async () => {
  const create = vi.spyOn(URL, 'createObjectURL')
  const file = new File(['video'], 'source.mp4', { type: 'video/mp4' })
  const props = { file, name: 'Source video', kind: 'video' as const }
  const html = await renderToString(
    createSSRApp({
      render: () => h(MediaSourcePreview, props)
    })
  )
  expect(create).not.toHaveBeenCalled()
  expect(html).not.toContain('blob:')
  render(MediaSourcePreview, { props })
  const video = await screen.findByLabelText('Source video')
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
    kind: 'video' as const,
    name: 'Input video',
    src: 'https://assets.example/source.mp4'
  }
  const { rerender, unmount } = render(MediaSourcePreview, { props })
  function video() {
    const element = screen.getByLabelText('Input video')
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

it('renders an audio source as an accessible audio element', () => {
  render(MediaSourcePreview, {
    props: {
      kind: 'audio',
      name: 'Input audio',
      src: 'https://assets.example/source.mp3'
    }
  })
  const element = screen.getByLabelText('Input audio')
  expect(element).toBeInstanceOf(HTMLAudioElement)
  expect(element.getAttribute('src')).toBe('https://assets.example/source.mp3')
})
