// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import type { FieldSchema, FileValue } from '../../config/workshop-playground'
import { MAX_UPLOAD_BYTES } from '../../config/workshop-playground'
import FileSourceInput from './FileSourceInput.vue'

const field: Extract<FieldSchema, { kind: 'file' }> = {
  kind: 'file',
  name: 'images',
  label: 'Images',
  required: false,
  accept: ['image/png'],
  maxBytes: MAX_UPLOAD_BYTES,
  multiple: true,
  maxItems: 2
}

function mountInput(
  disabled = false,
  schema = field,
  initialValue?: FileValue | FileValue[]
) {
  const value = ref<FileValue | FileValue[] | undefined>(initialValue)
  render(
    defineComponent({
      setup: () => () =>
        h(FileSourceInput, {
          field: schema,
          disabled,
          modelValue: value.value,
          'onUpdate:modelValue': (
            next: FileValue | FileValue[] | undefined
          ) => {
            value.value = next
          }
        })
    })
  )
  return value
}

async function drop(files: File[]) {
  await nextTick()
  const dataTransfer = new DataTransfer()
  for (const file of files) dataTransfer.items.add(file)
  await fireEvent.drop(screen.getByRole('group', { name: 'Images' }), {
    dataTransfer
  })
}

describe('file source selection', () => {
  it.for([
    { name: 'character.fbx', type: 'application/octet-stream', label: 'FBX' },
    { name: 'clip.mp4', type: 'video/mp4', label: 'MP4' },
    { name: 'voice.wav', type: 'audio/wav', label: 'WAV' },
    { name: 'attachment', type: '', label: 'File' }
  ])(
    'previews $name appropriately and preserves replacement/removal controls',
    async ({ name, type, label }) => {
      const user = userEvent.setup()
      const values = mountInput(false, { ...field, accept: [] })
      const file = new File([new Uint8Array(2048)], name, { type })
      await user.upload(
        screen.getByLabelText('Images', { selector: 'input' }),
        file
      )
      if (type.startsWith('video/') || type.startsWith('audio/')) {
        const preview = screen.getByLabelText(name)
        expect(preview).toBeInstanceOf(HTMLMediaElement)
        expect(preview).toHaveProperty('controls', true)
        expect(preview.getAttribute('src')).toMatch(/^blob:/)
      } else {
        expect(screen.getByText(label)).toBeTruthy()
        expect(screen.getByText('2 KB')).toBeTruthy()
      }
      expect(screen.queryByRole('img')).toBeNull()
      expect(values.value).toMatchObject([{ file }])
      expect(screen.getByText('Choose files or drop them here')).toBeTruthy()
      await user.click(screen.getByRole('button', { name: `Replace ${name}` }))
      const replacement = new File(['replacement bytes'], 'replacement.fbx', {
        type: 'application/octet-stream'
      })
      await user.upload(
        screen.getByLabelText('Images', { selector: 'input' }),
        replacement
      )
      expect(values.value).toMatchObject([{ file: replacement }])
      expect(
        screen.queryByRole('button', { name: `Remove ${name}` })
      ).toBeNull()
      await user.click(
        screen.getByRole('button', { name: 'Remove replacement.fbx' })
      )
      expect(values.value).toBeUndefined()
    }
  )

  it('does not treat a non-image preview URL as an image', () => {
    mountInput(
      false,
      { ...field, accept: [] },
      {
        name: 'character.fbx',
        type: 'application/octet-stream',
        size: 2048,
        previewUrl: 'https://example.com/character.fbx'
      }
    )
    expect(screen.getByText('FBX')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('still enforces declared non-image MIME types', async () => {
    const values = mountInput(false, { ...field, accept: ['video/mp4'] })
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    await drop([video])
    await drop([new File(['audio'], 'voice.wav', { type: 'audio/wav' })])
    expect(screen.getByRole('alert').textContent).toContain(
      'File type not supported'
    )
    expect(screen.getByRole('alert').textContent).toContain(
      'file selection has not changed'
    )
    expect(values.value).toMatchObject([{ file: video }])
    expect(
      screen.queryByRole('button', { name: 'Remove voice.wav' })
    ).toBeNull()
  })

  it('adds dropped images, replaces one in place and removes only the chosen image', async () => {
    const user = userEvent.setup()
    const value = mountInput()
    const first = new File(['one'], 'one.png', { type: 'image/png' })
    const second = new File(['two'], 'two.png', { type: 'image/png' })
    const replacement = new File(['new'], 'new.png', { type: 'image/png' })
    await user.upload(
      screen.getByLabelText('Images', { selector: 'input' }),
      first
    )
    await drop([second])
    expect(screen.getAllByRole('img')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Replace one.png' }))
    await user.upload(
      screen.getByLabelText('Images', { selector: 'input' }),
      replacement
    )
    expect(value.value).toMatchObject([{ file: replacement }, { file: second }])
    expect(screen.queryByRole('img', { name: 'one.png' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Remove new.png' }))
    expect(value.value).toMatchObject([{ file: second }])
    await user.click(screen.getByRole('button', { name: 'Remove two.png' }))
    expect(value.value).toBeUndefined()
    await user.upload(
      screen.getByLabelText('Images', { selector: 'input' }),
      second
    )
    expect(screen.getByRole('img', { name: 'two.png' })).toBeTruthy()
  })

  it.for([
    {
      file: new File(['one'], 'wrong.txt', { type: 'text/plain' }),
      error: 'File type not supported'
    },
    {
      file: new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'large.png', {
        type: 'image/png'
      }),
      error: 'File is over 25 MB'
    }
  ])(
    'keeps valid images when a drop is rejected: $error',
    async ({ file, error }) => {
      const value = mountInput()
      const first = new File(['one'], 'one.png', { type: 'image/png' })
      await drop([first])
      await drop([file])
      expect(screen.getByRole('alert').textContent).toContain(error)
      expect(screen.getByRole('alert').textContent).toContain(
        'selection has not changed'
      )
      expect(value.value).toMatchObject([{ file: first }])
      expect(screen.getByRole('img', { name: 'one.png' })).toBeTruthy()
    }
  )

  it('rejects an over-limit selection without truncating or discarding existing images', async () => {
    const value = mountInput()
    const first = new File(['one'], 'one.png', { type: 'image/png' })
    await drop([first])
    await drop([
      new File(['two'], 'two.png', { type: 'image/png' }),
      new File(['three'], 'three.png', { type: 'image/png' })
    ])
    expect(screen.getByRole('alert').textContent).toContain(
      'Choose up to 2 images.'
    )
    expect(value.value).toMatchObject([{ file: first }])
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('ignores file drops while disabled', async () => {
    const value = mountInput(true)
    await drop([new File(['one'], 'one.png', { type: 'image/png' })])
    expect(value.value).toBeUndefined()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
