/**
 * Registration script for Vue loader
 * Used with --import flag in Node.js to stub Vue files during i18n collection
 */

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Get the directory of this file
const __dirname = dirname(fileURLToPath(import.meta.url))

// Register the Vue loader
register(pathToFileURL(join(__dirname, 'vueLoader.mjs')))