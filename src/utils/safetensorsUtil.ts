export interface ModelSpec {
  'modelspec.sai_model_spec': string
  'modelspec.architecture': string
  'modelspec.title': string
  'modelspec.description': string
}

const architectureToType: Record<string, string> = {
  'stable-diffusion-v1': 'checkpoints',
  'stable-diffusion-xl-v1-base': 'checkpoints',
  'Flux.1-schnell': 'checkpoints',
  'Flux.1-dev': 'checkpoints',
  'Flux.1-AE': 'vae'
}

interface SafetensorsHeader<TMetadata = Record<string, string> | ModelSpec> {
  [k: string]: unknown
  __metadata__?: TMetadata
}

export async function guessModelType(file: File): Promise<string | null> {
  const header = await getHeader(file)
  if (!header) return null

  let suggestedType: string | null
  if (isModelSpec(header)) {
    suggestedType = guessFromModelSpec(header)
  }

  suggestedType ??= guessFromHeaderKeys(header)

  return suggestedType
}

async function getHeader(file: File): Promise<SafetensorsHeader | null> {
  try {
    // 8 bytes: an unsigned little-endian 64-bit integer, containing the size of the header
    // Slice the first 8 bytes so we don't read the whole file
    const headerSizeBlob = file.slice(0, 8)
    const headerSizeView = new DataView(await headerSizeBlob.arrayBuffer())
    const headerSize = headerSizeView.getBigUint64(0, true)

    if (
      headerSize < 0 ||
      headerSize > file.size ||
      headerSize > Number.MAX_SAFE_INTEGER
    ) {
      // Invalid header, probably not a safetensors file
      console.log(`Invalid header size ${headerSize} for file '${file.name}'`)
      return null
    }

    // N bytes: a JSON UTF-8 string representing the header.
    const header = file.slice(8, Number(headerSize) + 8)
    const content = await header.text()
    return JSON.parse(content)
  } catch (error) {
    // Error reading the file, probably not a safetensors file
    console.error(`Error reading safetensors header '${file.name}'`, error)
    return null
  }
}

function guessFromModelSpec(header: SafetensorsHeader<ModelSpec>) {
  const architecture = header.__metadata__?.['modelspec.architecture']
  if (!architecture) return null
  let suggestedType = architectureToType[architecture]
  if (!suggestedType) {
    if (architecture?.endsWith('/lora')) {
      suggestedType = 'loras'
    }
  }

  return suggestedType
}

function guessFromHeaderKeys(header: SafetensorsHeader) {
  let suggestedType: string | null = null
  const keys = Object.keys(header)
  if (keys.find((k) => k.startsWith('lora_unet_'))) {
    suggestedType = 'loras'
  } else if (keys.find((k) => k.startsWith('model.diffusion_model.'))) {
    suggestedType = 'checkpoints'
  }

  return suggestedType
}

function isModelSpec(
  header: SafetensorsHeader
): header is SafetensorsHeader<ModelSpec> {
  return !!header.__metadata__?.['modelspec.sai_model_spec']
}
