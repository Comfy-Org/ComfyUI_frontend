import { execFileSync } from 'node:child_process'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'

import { workshopExampleFile } from '../../config/workshop-example-file'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import { workshopContract } from '../../config/workshop-contract-catalog'
import defaultMedia from '../../data/router-default-media.json'
import ApiTab from './ApiTab.vue'

it('omits embedded default media from the cURL example', async () => {
  const model = getRouterWorkshopModelDetail('bfl--flux-pro-fill--edit-images')
  if (!model) throw new Error('Missing FLUX Fill page')
  render(ApiTab, {
    props: {
      contract: model.execution,
      values: initialWorkshopPageState(model).values
    }
  })
  const snippet = await screen.findByTestId('snippet')
  await userEvent.setup().click(screen.getByRole('tab', { name: 'cURL' }))
  const args = execFileSync(
    'bash',
    ['-c', 'curl() { printf \'%s\\0\' "$@"; }\n' + snippet.textContent],
    {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, COMFY_API_KEY: 'test-key' }
    }
  ).split('\0')
  const parameters = JSON.parse(args[args.indexOf('--data') + 1])
  expect(parameters).not.toHaveProperty('image')
  expect(parameters).not.toHaveProperty('mask')
  expect(snippet.textContent).not.toContain(defaultMedia.image)
  expect(snippet.textContent).not.toContain(defaultMedia.mask)
  expect(screen.getByRole('note').textContent).toContain(
    'cURL cannot carry your uploaded files'
  )
})

it('a copied cURL example starts distinct executions with fresh idempotency keys', async () => {
  const visitor = userEvent.setup()
  render(ApiTab, {
    props: {
      contract: workshopContract('bfl/flux-2-pro'),
      values: { prompt: 'A watercolor sunflower', seed: 42 }
    }
  })
  const snippet = await screen.findByTestId('snippet')
  await visitor.click(screen.getByTestId('snippet-curl'))
  const run = () =>
    execFileSync(
      'bash',
      ['-c', 'curl() { printf \'%s\\0\' "$@"; }\n' + snippet.textContent],
      {
        encoding: 'utf8',
        env: { PATH: process.env.PATH, COMFY_API_KEY: 'test-key' }
      }
    ).split('\0')
  const first = run()
  const second = run()
  const key = (args: string[]) =>
    args.find((argument) => argument.startsWith('Idempotency-Key: '))
  expect(key(first)).toMatch(/^Idempotency-Key: [\da-f-]{36}$/i)
  expect(key(second)).toMatch(/^Idempotency-Key: [\da-f-]{36}$/i)
  expect(key(second)).not.toBe(key(first))
  expect(JSON.parse(first[first.indexOf('--data') + 1])).toEqual({
    prompt: 'A watercolor sunflower',
    seed: 42
  })
})

it('copies all selected Seedream reference URLs into an executable cURL request', async () => {
  const visitor = userEvent.setup()
  const model = getRouterWorkshopModelDetail(
    'byteplus--seedream-4-5--edit-images'
  )
  if (!model) throw new Error('Missing Seedream edit page')
  const urls = ['first', 'second', 'third'].map(
    (name) => `https://source.example/${name}.webp`
  )
  const images = urls.map((url) => {
    const file = workshopExampleFile(url)
    if (!file) throw new Error('Invalid fixture URL')
    return file
  })
  render(ApiTab, {
    props: {
      contract: model.execution,
      values: { ...initialWorkshopPageState(model).values, images }
    }
  })
  await screen.findByTestId('snippet')
  await visitor.click(screen.getByRole('tab', { name: 'cURL' }))
  const args = execFileSync(
    'bash',
    [
      '-c',
      'curl() { printf \'%s\\0\' "$@"; }\n' +
        screen.getByTestId('snippet').textContent
    ],
    {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, COMFY_API_KEY: 'test-key' }
    }
  ).split('\0')
  const parameters = JSON.parse(args[args.indexOf('--data') + 1])
  expect(parameters.image).toEqual(urls)
  expect(screen.queryByRole('note')).toBeNull()
})
