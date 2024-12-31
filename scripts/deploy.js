import { config } from 'dotenv'
import { copy } from 'fs-extra'

config()

const sourceDir = './dist'
// eslint-disable-next-line no-undef
const targetDir = process.env.DEPLOY_COMFYUI_DIR

copy(sourceDir, targetDir)
  .then(() => {
    console.log(`Directory copied successfully! ${sourceDir} -> ${targetDir}`)
  })
  .catch((err) => {
    console.error('Error copying directory:', err)
  })
