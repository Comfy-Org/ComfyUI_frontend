import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { editorRequest } from '@/lib/cms/editor-client'
import MediaUpload from './MediaUpload.vue'

vi.mock(import('@/lib/cms/editor-client'))
const uid = '00000000-0000-4000-8000-000000000001'
const revision = '00000000-0000-4000-8000-000000000002'
const later = '00000000-0000-4000-8000-000000000003'
async function choose() {
  await userEvent
    .setup({ applyAccept: false })
    .upload(
      screen.getByLabelText('Choose image, video or workflow JSON'),
      new File(['png'], 'a file.png', { type: 'image/png' })
    )
}
function setup() {
  return render(MediaUpload, {
    props: {
      reference: { src: 'r2', id: uid, file_version_uid: revision },
      entityUID: uid,
      draft: 7,
      csrf: 'a'.repeat(64),
      mediaRole: 'hero'
    }
  })
}
describe('media editing', () => {
  it('a WebP-only card still refuses other images before any request', async () => {
    vi.mocked(editorRequest).mockClear()
    render(MediaUpload, {
      props: {
        entityUID: uid,
        draft: 7,
        csrf: 'a'.repeat(64),
        mediaRole: 'static_thumb',
        accept: ['image/webp'],
        maxBytes: 160 << 10,
        hint: 'WebP only'
      }
    })
    expect(screen.getByText('WebP only')).toBeVisible()
    expect(
      screen.getByLabelText('Choose image, video or workflow JSON')
    ).toHaveAttribute('accept', 'image/webp')
    await choose()
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload as new media' })
    )
    expect(screen.getByRole('alert')).toBeVisible()
    expect(editorRequest).not.toHaveBeenCalled()
  })
  it('new uploads deliberately create a new logical UID instead of replacing the existing one', async () => {
    const result = setup()
    vi.mocked(editorRequest).mockResolvedValue({
      ok: true,
      status: 201,
      data: { uid: later, revision_uid: revision }
    })
    await choose()
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload as new media' })
    )
    await waitFor(() => expect(result.emitted().update).toHaveLength(1))
    const [operation, options] = vi.mocked(editorRequest).mock.calls[0]
    expect(operation).toBe('upload')
    expect(options?.body).toBeInstanceOf(FormData)
    if (!(options?.body instanceof FormData))
      throw new Error('Missing upload envelope')
    expect(options.body.has('media_uid')).toBe(false)
    expect(options.body.get('name')).toBe('a-file.png')
    expect(result.emitted().update[0]).toEqual([
      { src: 'r2', id: later, file_version_uid: revision, name: 'a-file.png' }
    ])
  })
  it('replacement retries use exactly the same token, bytes and key after uncertain response', async () => {
    setup()
    vi.mocked(editorRequest)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { type: 'media', revision_uid: later }
      })
      .mockResolvedValueOnce({ ok: false, status: 503, data: undefined })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { uid, revision_uid: revision }
      })
    await choose()
    await userEvent.click(
      screen.getByRole('button', { name: 'Replace this media UID' })
    )
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible())
    await userEvent.click(
      screen.getByRole('button', { name: 'Replace this media UID' })
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledTimes(3))
    const calls = vi.mocked(editorRequest).mock.calls
    expect(calls[0][0]).toBe('item')
    expect(calls[1][0]).toBe('upload')
    expect(calls[2][0]).toBe('upload')
    expect(calls[1][1]).toEqual(calls[2][1])
    const body = calls[1][1]?.body
    if (!(body instanceof FormData))
      throw new Error('Missing replacement envelope')
    expect(body.get('expected_revision_uid')).toBe(later)
    expect(body.get('media_uid')).toBe(uid)
  })
  it.for(['mp4', 'webm'])(
    'allows %s videos through to authoritative byte verification',
    async (extension) => {
      const result = setup()
      vi.mocked(editorRequest).mockResolvedValue({
        ok: true,
        status: 201,
        data: { uid: later, revision_uid: revision }
      })
      await userEvent.setup({ applyAccept: false }).upload(
        screen.getByLabelText('Choose image, video or workflow JSON'),
        new File(['video'], `sample.${extension}`, {
          type: `video/${extension}`
        })
      )
      await userEvent.click(
        screen.getByRole('button', { name: 'Upload as new media' })
      )
      await waitFor(() => expect(result.emitted().update).toHaveLength(1))
      const body = vi.mocked(editorRequest).mock.calls[0][1]?.body
      if (!(body instanceof FormData)) throw new Error('Missing video envelope')
      expect(body.get('file')).toBeInstanceOf(File)
      expect(body.get('name')).toBe(`sample.${extension}`)
    }
  )
  it('rejects unsupported media locally without promising arbitrary codecs', async () => {
    setup()
    await userEvent
      .setup({ applyAccept: false })
      .upload(
        screen.getByLabelText('Choose image, video or workflow JSON'),
        new File(['video'], 'sample.avi', { type: 'video/x-msvideo' })
      )
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload as new media' })
    )
    expect(screen.getByRole('alert')).toBeVisible()
    expect(editorRequest).not.toHaveBeenCalled()
  })
})
