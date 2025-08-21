import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const fileName = fileURLToPath(import.meta.url)
const dirName = dirname(fileName)
const customIconsPath = join(dirName, '..', 'src', 'assets', 'icons', 'custom')

// Create an Iconify collection for custom icons
export const iconCollection = {
  prefix: 'comfy',
  icons: {},
  width: 16,
  height: 16
}

// Read all SVG files from the custom icons directory
const files = readdirSync(customIconsPath)
files.forEach((file) => {
  if (file.endsWith('.svg')) {
    const name = file.replace('.svg', '')
    const content = readFileSync(join(customIconsPath, file), 'utf-8')

    iconCollection.icons[name] = {
      body: content
    }
  }
})
