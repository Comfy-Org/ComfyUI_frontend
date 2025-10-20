import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const fileName = fileURLToPath(import.meta.url)
const dirName = dirname(fileName)
const customIconsPath = join(dirName, 'icons')

// Iconify collection structure
interface IconifyIcon {
  body: string
  width?: number
  height?: number
}

interface IconifyCollection {
  prefix: string
  icons: Record<string, IconifyIcon>
  width?: number
  height?: number
}

// Create an Iconify collection for custom icons
export const iconCollection: IconifyCollection = {
  prefix: 'comfy',
  icons: {},
  width: 16,
  height: 16
}

/**
 * Validates that an SVG file contains valid SVG content
 */
function validateSvgContent(content: string, filename: string): void {
  if (!content.trim()) {
    throw new Error(`Empty SVG file: ${filename}`)
  }

  if (!content.includes('<svg')) {
    throw new Error(`Invalid SVG file (missing <svg> tag): ${filename}`)
  }

  // Basic XML structure validation
  const openTags = (content.match(/<svg[^>]*>/g) || []).length
  const closeTags = (content.match(/<\/svg>/g) || []).length

  if (openTags !== closeTags) {
    throw new Error(`Malformed SVG file (mismatched svg tags): ${filename}`)
  }
}

/**
 * Loads custom SVG icons from the icons directory
 */
function loadCustomIcons(): void {
  if (!existsSync(customIconsPath)) {
    console.warn(`Custom icons directory not found: ${customIconsPath}`)
    return
  }

  try {
    const files = readdirSync(customIconsPath)
    const svgFiles = files.filter((file) => file.endsWith('.svg'))

    if (svgFiles.length === 0) {
      console.warn('No SVG files found in custom icons directory')
      return
    }

    svgFiles.forEach((file) => {
      const name = file.replace('.svg', '')
      const filePath = join(customIconsPath, file)

      try {
        const content = readFileSync(filePath, 'utf-8')
        validateSvgContent(content, file)

        iconCollection.icons[name] = {
          body: content
        }
      } catch (error) {
        console.error(
          `Failed to load custom icon ${file}:`,
          error instanceof Error ? error.message : error
        )
        // Continue loading other icons instead of failing the entire build
      }
    })
  } catch (error) {
    console.error(
      'Failed to read custom icons directory:',
      error instanceof Error ? error.message : error
    )
    // Don't throw here - allow build to continue without custom icons
  }
}

// Load icons when this module is imported
loadCustomIcons()
