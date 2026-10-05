export interface ModelDeveloper {
  readonly name: string
  readonly url: string
  readonly wikidata?: string
}

const alibabaCloud: ModelDeveloper = {
  name: 'Alibaba Cloud',
  url: 'https://www.alibabacloud.com/',
  wikidata: 'Q17062154'
}

/**
 * Catalogue provider label to the organisation that developed its models.
 * `null` marks a host whose model developer is not yet known. Wikidata ids were
 * checked on 2026-09-25; developers without an organisation entry have none.
 */
export const MODEL_DEVELOPERS: Readonly<Record<string, ModelDeveloper | null>> =
  {
    Beeble: { name: 'Beeble', url: 'https://beeble.ai/' },
    'Black Forest Labs': {
      name: 'Black Forest Labs',
      url: 'https://bfl.ai/',
      wikidata: 'Q128801641'
    },
    Bria: { name: 'Bria', url: 'https://bria.ai/' },
    ByteDance: {
      name: 'ByteDance',
      url: 'https://www.bytedance.com/',
      wikidata: 'Q55606242'
    },
    ElevenLabs: {
      name: 'ElevenLabs',
      url: 'https://elevenlabs.io/',
      wikidata: 'Q116798355'
    },
    Freepik: {
      name: 'Freepik',
      url: 'https://www.freepik.com/',
      wikidata: 'Q97573128'
    },
    Google: {
      name: 'Google DeepMind',
      url: 'https://deepmind.google/',
      wikidata: 'Q15733006'
    },
    Heygen: {
      name: 'HeyGen',
      url: 'https://www.heygen.com/',
      wikidata: 'Q123258741'
    },
    Ideogram: { name: 'Ideogram', url: 'https://ideogram.ai/' },
    Kling: {
      name: 'Kuaishou',
      url: 'https://www.kuaishou.com/',
      wikidata: 'Q47015540'
    },
    Krea: { name: 'Krea', url: 'https://www.krea.ai/', wikidata: 'Q135906383' },
    Luma: { name: 'Luma AI', url: 'https://lumalabs.ai/' },
    OpenAI: {
      name: 'OpenAI',
      url: 'https://openai.com/',
      wikidata: 'Q21708200'
    },
    Qwen: alibabaCloud,
    Recraft: { name: 'Recraft', url: 'https://www.recraft.ai/' },
    Runway: {
      name: 'Runway',
      url: 'https://runwayml.com/',
      wikidata: 'Q123367593'
    },
    Wan: alibabaCloud,
    WaveSpeed: null,
    xAI: { name: 'xAI', url: 'https://x.ai/', wikidata: 'Q120599684' }
  }

export function modelDeveloper(
  provider: string | undefined
): ModelDeveloper | undefined {
  if (!provider || !Object.hasOwn(MODEL_DEVELOPERS, provider)) return undefined
  return MODEL_DEVELOPERS[provider] ?? undefined
}
