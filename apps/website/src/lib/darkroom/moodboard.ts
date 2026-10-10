/**
 * A moodboard is a named set of images. Generating with one packs its images
 * into grid sheets, sent after the user's own references, and the request
 * adds a note telling the model to read them as art direction.
 */
import type { DarkroomImageInput } from './request'

const SHEET_MAX = 6
const SHEETS_MAX = 6
const CELL = 512
const GAP = 8
/** The page background, behind the gaps of a sheet. */
const SHEET_BACKGROUND = 'rgb(17 17 17)'

/**
 * Spreads a board's images evenly over the fewest sheets: 30 make 5 sheets of
 * 6, 25 make 5 of 5, 7 make 4 and 3. A board past 36 images is sampled evenly
 * down to 36, so at most 6 sheets go out.
 */
export function planSheets<T>(items: readonly T[]): T[][] {
  const cap = SHEET_MAX * SHEETS_MAX
  const list =
    items.length > cap
      ? Array.from(
          { length: cap },
          (_, index) => items[Math.floor((index * items.length) / cap)]
        )
      : [...items]
  const count = Math.ceil(list.length / SHEET_MAX)
  const sheets: T[][] = []
  let start = 0
  for (let index = 0; index < count; index++) {
    const size = Math.ceil((list.length - start) / (count - index))
    sheets.push(list.slice(start, start + size))
    start += size
  }
  return sheets
}

/** Columns and rows for a sheet of `count` images. Four sit two by two. */
export function sheetGrid(count: number): { cols: number; rows: number } {
  const cols = count === 4 ? 2 : Math.min(3, count)
  return { cols, rows: Math.ceil(count / cols) }
}

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = url
  })
}

/** Draws one sheet, cover-cropping each image into its square cell. */
export async function drawSheet(
  urls: readonly string[]
): Promise<DarkroomImageInput | undefined> {
  const images = (await Promise.all(urls.map(loadImage))).filter(
    (image) => image !== undefined
  )
  if (!images.length) return undefined
  const { cols, rows } = sheetGrid(images.length)
  const canvas = document.createElement('canvas')
  canvas.width = cols * CELL + (cols + 1) * GAP
  canvas.height = rows * CELL + (rows + 1) * GAP
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.fillStyle = SHEET_BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)
  images.forEach((image, index) => {
    const scale = Math.max(
      CELL / image.naturalWidth,
      CELL / image.naturalHeight
    )
    const side = CELL / scale
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      GAP + (index % cols) * (CELL + GAP),
      GAP + Math.floor(index / cols) * (CELL + GAP),
      CELL,
      CELL
    )
  })
  return {
    mime: 'image/jpeg',
    data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
  }
}

export async function fileToInput(
  file: Blob
): Promise<DarkroomImageInput & { url: string }> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return { mime: file.type || 'image/png', data: url.split(',')[1], url }
}
