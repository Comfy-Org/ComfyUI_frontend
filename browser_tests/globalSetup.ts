import { FullConfig } from '@playwright/test'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

import { backupPath } from './utils/backupUtils'

dotenv.config()

export default function globalSetup(config: FullConfig) {
  if (!process.env.CI) {
    if (process.env.TEST_COMFYUI_DIR) {
      backupPath([process.env.TEST_COMFYUI_DIR, 'user'])
      backupPath([process.env.TEST_COMFYUI_DIR, 'models'], {
        renameAndReplaceWithScaffolding: true
      })
    } else {
      console.warn(
        'Set TEST_COMFYUI_DIR in .env to prevent user data (settings, workflows, etc.) from being overwritten'
      )
    }
  }

  // Create default user by writing directly to users.json file
  // This bypasses the API and ensures the user exists at filesystem level
  // TODO: Remove this once the backend is fixed
  try {
    const testComfyuiDir = process.env.TEST_COMFYUI_DIR
    if (!testComfyuiDir) {
      console.warn('TEST_COMFYUI_DIR is not set')
      return
    }
    const usersJsonPath = path.join(testComfyuiDir, 'user', 'users.json')

    console.log('Creating default user in users.json...')

    // Ensure user directory exists
    const userDirPath = path.dirname(usersJsonPath)
    if (!fs.existsSync(userDirPath)) {
      fs.mkdirSync(userDirPath, { recursive: true })
    }

    // Create or update users.json with default user
    let users = {}
    if (fs.existsSync(usersJsonPath)) {
      const existingContent = fs.readFileSync(usersJsonPath, 'utf8')
      users = JSON.parse(existingContent)
    }

    // Add default user if it doesn't exist
    if (!users['default']) {
      users['default'] = 'default'
      fs.writeFileSync(usersJsonPath, JSON.stringify(users))
      console.log('Default user added to users.json successfully')
    } else {
      console.log('Default user already exists in users.json')
    }
  } catch (error) {
    console.warn('Failed to create default user in users.json:', error)
  }
}
