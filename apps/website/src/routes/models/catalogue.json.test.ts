import { expect, it } from 'vitest'

import { appModels } from '../../config/workshop-app-content'
import { workshopPages } from '../../config/workshop-page-content'
import { GET } from './catalogue.json'

it('serves the catalogue cards, apps included, as JSON', async () => {
  const response = GET()

  expect(response.headers.get('Content-Type')).toBe('application/json')
  expect(await response.json()).toEqual(
    JSON.parse(JSON.stringify([...workshopPages, ...appModels]))
  )
})
