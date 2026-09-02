import * as migration_20260826_142147_initial from './20260826_142147_initial'
import * as migration_20260902_174221_composite_media_prefix from './20260902_174221_composite_media_prefix'

export const migrations = [
  {
    up: migration_20260826_142147_initial.up,
    down: migration_20260826_142147_initial.down,
    name: '20260826_142147_initial',
  },
  {
    up: migration_20260902_174221_composite_media_prefix.up,
    down: migration_20260902_174221_composite_media_prefix.down,
    name: '20260902_174221_composite_media_prefix',
  },
]
