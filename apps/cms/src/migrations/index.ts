import * as migration_20260826_142147_initial from './20260826_142147_initial'

export const migrations = [
  {
    up: migration_20260826_142147_initial.up,
    down: migration_20260826_142147_initial.down,
    name: '20260826_142147_initial',
  },
]
