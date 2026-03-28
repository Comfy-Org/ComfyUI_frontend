/* eslint-disable no-console */
import { faker } from '@faker-js/faker'

// Original schema
faker.seed(12345)
const original = Array.from({ length: 5 }, () => ({
  name: faker.system.fileName(),
  size: faker.number.int({ min: 1000, max: 10000000 }),
  type: faker.helpers.arrayElement(['image', 'model', 'checkpoint']),
}))

// Modified schema — extra field inserted BEFORE 'type'
faker.seed(12345)
const modified = Array.from({ length: 5 }, () => ({
  name: faker.system.fileName(),
  size: faker.number.int({ min: 1000, max: 10000000 }),
  author: faker.person.fullName(), // NEW FIELD inserted before 'type'
  type: faker.helpers.arrayElement(['image', 'model', 'checkpoint']),
}))

console.log('=== Schema mutation stability test ===')
for (let i = 0; i < 5; i++) {
  const nameMatch = original[i].name === modified[i].name
  const sizeMatch = original[i].size === modified[i].size
  const typeMatch = original[i].type === modified[i].type
  console.log(
    `Record ${i}: name=${nameMatch ? 'STABLE' : 'CHANGED'} size=${sizeMatch ? 'STABLE' : 'CHANGED'} type=${typeMatch ? 'STABLE' : 'CHANGED'}`
  )
  if (!nameMatch) console.log(`  name: "${original[i].name}" -> "${modified[i].name}"`)
  if (!sizeMatch) console.log(`  size: ${original[i].size} -> ${modified[i].size}`)
  if (!typeMatch) console.log(`  type: "${original[i].type}" -> "${modified[i].type}"`)
}
