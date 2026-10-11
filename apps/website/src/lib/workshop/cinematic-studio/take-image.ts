import type { RouterParameterName } from '@/config/router-parameters'
import {
  createRouterParameters,
  routerParameterMappings
} from '@/config/router-parameters'
import type { WorkshopContract } from '@/config/workshop-contract'
import { formForContract } from '@/config/workshop-contract'
import { defaultValues, schemaForModel } from '@/config/workshop-playground'

/*
 * A finished take reused as an input. Most providers return a link the page
 * is not allowed to read (their storage sends no CORS header), so the take is
 * kept as a reference to that output: the link, which a model's own server can
 * fetch, and the picture itself when the page could download it.
 *
 * Long term the Router should keep every output and accept it back by asset
 * id; then this becomes that id and nothing here downloads anything.
 */
interface TakeImage {
  readonly url: string
  readonly name: string
  /** The picture, when the page could read it. */
  readonly file?: File
}

/** An input image: one the visitor added, or a take reused. */
export type StudioImage = File | TakeImage

function isTakeImage(image: StudioImage | undefined): image is TakeImage {
  return !!image && !(image instanceof File)
}

/** A file to show or count, when there is one. */
export function imageFile(image: StudioImage | undefined): File | undefined {
  return isTakeImage(image) ? image.file : image
}

/** Something an `<img>` can show: a picture the page holds, or the link. */
export function imageSource(
  image: StudioImage | undefined
): Blob | string | undefined {
  if (!image) return undefined
  return isTakeImage(image) ? (image.file ?? image.url) : image
}

async function download(url: string, name: string): Promise<File | undefined> {
  const blob = await fetch(url)
    .then((response) => (response.ok ? response.blob() : undefined))
    .catch(() => undefined)
  return blob && new File([blob], name, { type: blob.type || 'image/png' })
}

/**
 * Keeps a take for reuse. A web link is kept even when the page cannot read
 * it, since a model that takes links fetches it itself; a picture held only
 * by the page (a `blob:` URL) must be read now.
 */
export async function keepTake(
  url: string,
  name: string
): Promise<StudioImage | undefined> {
  const file = await download(url, name)
  if (!url.startsWith('https://')) return file
  return { url, name, ...(file ? { file } : {}) }
}

/**
 * What to send for an input: the link to a model that takes links (no upload,
 * so nothing for the browser to block), the picture to one that does not.
 * Undefined when that model needs a picture the page could not read.
 */
export function imageInput(
  image: StudioImage,
  takesLinks: boolean
): File | string | undefined {
  if (!isTakeImage(image)) return image
  return takesLinks ? image.url : image.file
}

const PROBE = 'https://example.com/take.png'

/** Whether a contract's input for this parameter accepts a web link as is. */
export function acceptsLinks(
  contract: WorkshopContract | undefined,
  parameter: RouterParameterName
): boolean {
  if (!contract) return false
  const schema = schemaForModel({ fields: [], form: formForContract(contract) })
  const mappings = routerParameterMappings(contract)
  const sample =
    parameter === 'reference_images' || parameter === 'source_images'
      ? [PROBE]
      : PROBE
  const mapped = schema.flatMap((field) => {
    const value = createRouterParameters(
      [field],
      defaultValues([field]),
      mappings
    ).router_get_closest_value(sample, parameter)
    return value === undefined ? [] : [JSON.stringify(value)]
  })
  return (
    mapped.length > 0 &&
    mapped.every(
      (value) => value.includes(PROBE) && !value.includes('previewUrl')
    )
  )
}
