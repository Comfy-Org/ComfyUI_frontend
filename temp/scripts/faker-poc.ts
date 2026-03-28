/* eslint-disable no-console */
import { faker } from '@faker-js/faker'

// Seed for determinism
faker.seed(12345)

// Generate 10 mock asset records
const assets = Array.from({ length: 10 }, () => ({
  name: faker.system.fileName(),
  size: faker.number.int({ min: 1000, max: 10000000 }),
  type: faker.helpers.arrayElement(['image', 'model', 'checkpoint']),
  path: faker.system.filePath(),
  modified: faker.date.recent().toISOString(),
}))

console.log('Assets:', JSON.stringify(assets, null, 2))

// Generate 50 items for infinite scroll
faker.seed(12345) // Re-seed to test stability
const scrollItems = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  title: faker.lorem.words(3),
  description: faker.lorem.sentence(),
}))

console.log(`\nGenerated ${scrollItems.length} scroll items`)
console.log('First 3:', JSON.stringify(scrollItems.slice(0, 3), null, 2))
