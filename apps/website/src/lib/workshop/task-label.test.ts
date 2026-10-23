import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'

import { nameWithoutTask, taskLabelFor } from './task-label'

function model(
  task: WorkshopModel['task'],
  modality: WorkshopModel['modality']
): WorkshopModel {
  return {
    slug: 'seedream',
    name: 'Seedream',
    workflowCount: 1,
    href: '/models/seedream/',
    routerId: 'test/seedream',
    capabilities: [],
    task,
    modality
  }
}

describe('the task pill on a card', () => {
  it.for([
    ['text-to-image', 'image', 'Text to image'],
    ['image-to-video', 'video', 'Image to video'],
    ['audio-to-text', 'text', 'Audio to text'],
    ['image-to-3d', '3d', 'Image to 3D']
  ] as const)(
    'reads %s mid-sentence, naming the input and the output',
    ([task, modality, label]) => {
      expect(taskLabelFor(model(task, modality), 'en')).toBe(label)
    }
  )

  it.for([
    ['the task names no real output', 'text-to-other', 'image', 'Image'],
    ['the model states no task', undefined, 'video', 'Video']
  ] as const)(
    'names only what comes out when %s',
    ([, task, modality, label]) => {
      expect(taskLabelFor(model(task, modality), 'en')).toBe(label)
    }
  )
})

describe('a card name beside its task pill', () => {
  it.for([
    ['Seedream 5.0 Pro Text-to-Image', 'Text to Image', 'Seedream 5.0 Pro'],
    ['LTX-2.5 Image-to-Video', 'Image to Video', 'LTX-2.5'],
    ['Seedance 2.0 Image to Video', 'Image to Video', 'Seedance 2.0'],
    ['Kling Lip Sync Audio-to-Video', 'Audio to Video', 'Kling Lip Sync']
  ] as const)('drops the tail of %s', ([name, task, shortened]) => {
    expect(nameWithoutTask(name, task)).toBe(shortened)
  })

  it.for([
    ['the tail names another task', 'FLUX 3 Text-to-Video', 'Image to Video'],
    ['the name says nothing of it', 'Nano Banana Pro', 'Text to Image'],
    ['the name is only the task', 'Image to Video', 'Image to Video'],
    ['there is no pill to repeat', 'LTX-2.5 Image-to-Video', '']
  ] as const)('keeps the whole name when %s', ([, name, task]) => {
    expect(nameWithoutTask(name, task)).toBe(name)
  })

  it('reads the pill in the reader’s own language', () => {
    expect(nameWithoutTask('Seedream 5.0 文生图', '文生图')).toBe(
      'Seedream 5.0'
    )
  })
})
