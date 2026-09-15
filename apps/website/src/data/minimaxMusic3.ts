import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// The full structured caption + lyrics behind each track. The card clamps this
// to five lines on screen; the copy button hands over the whole thing. It is a
// model prompt, not UI copy, so both locales share the one English source.
const gospelSoulPrompt = `Caption:
Global Metadata:
Genre: gospel soul — Sunday-morning church band with a vintage soul recording character. BPM: 76 in a 12/8 triplet feel. Key: Eb major. Emotional progression: reverent hush in the intro, testifying build through verse one, full-throated communal celebration at each chorus, joyful vamping release in the outro. Listening scenario: a church service, a family kitchen on Sunday, a moment of gratitude. Production profile: warm vintage analog, ribbon-mic character, natural room bleed, tape compression, no modern electronic elements at all, no synths, no programmed drums. Target duration: approximately 150 seconds.

Vocal Details:

Male lead, rich gospel baritone with grit and heavy melisma, able to break into a raw falsetto cry on peaks. Verses start restrained and conversational, escalating line by line. Full mixed-gender choir (soprano, alto, tenor, bass) answering on every chorus in call-and-response, singing the hook back to the lead. Improvised lead ad-libs — "yes", "come on", "one more time" — over the choir throughout the second chorus and the outro. Vocals recorded with room bleed and natural plate reverb, never pitch-perfect, human and slightly ragged.

Arrangement:

Core instruments: Hammond B3 organ with rotary speaker, acoustic grand piano, electric bass (round and melodic), live drum kit with brushes moving to sticks, tambourine, clean electric guitar with light tremolo, hand claps.

Intro (0:00-0:14): solo organ swell with slow rotary, piano answering in triplets, no drums, lead vocal humming.

Verse 1: piano leads with gospel triplet chords, bass enters walking, drums on brushes only, organ holding pads underneath.

Chorus 1: drums switch to sticks, tambourine on the backbeat, choir enters in full four-part harmony, organ opens up to fast rotary.

Verse 2: pull the choir out, drop drums back to rim and tambourine to reset the dynamic, keep the bass moving, add guitar comping.

Chorus 2: fullest arrangement, choir doubled, organ soloing in the gaps, drum fills between every line, key feel lifting in energy without modulating.

Outro: vamp on the hook, drums half-time and heavy, lead ad-libbing freely over the choir repeating the title, ending on one held choir chord with organ tail.

Groove: slow 12/8 triplet gospel shuffle, heavy backbeat on 2 and 4, bass walking through passing chords, pushed and lived-in rather than quantized. Textures: rotary organ swirl, room air, tambourine shimmer, hand claps.

Lyrics:

[Intro]
Oh...
It all connects
Mm, it all connects

[Verse]
I came in here with nothing but a feeling and a name
A blinking empty window and a hunger I can't tame
Laid the first one down and let it wait there in the dark
Drew a line out to another and I felt it catch a spark
One to the next, and the next, and the next
Ain't a single thing standing on its own

[Chorus]
IT ALL CONNECTS — hallelujah, it all connects
Every little line I drew, it all connects
What I couldn't do alone, somebody left it here for me
And it all connects, oh Lord, it all connects

[Verse]
Somebody in a country I will never get to see
Gave away the thing they made and gave it straight to me
And I gave mine to a stranger who was struggling with the same
Now the whole thing is a river and we're calling it by name
No gate, no key, no permission and no price
Just a hand and then a hand and then a hand

[Chorus]
IT ALL CONNECTS — hallelujah, it all connects
Every little line I drew, it all connects
What I couldn't do alone, somebody left it here for me
And it all connects, oh Lord, it all connects

[Outro]
It all connects (it all connects)
Say it one more time now (it all connects)
From my hands to your hands
Oh, it all connects`

const rockInstrumentalPrompt = `Caption:
Global Metadata:
Genre: rock. Subgenre: instrumental guitar rock. BPM: 124. Key: E minor. Scale: natural minor with blues inflections. Emotional progression: confident opening riff to steady groove to soaring emotional solo to a hard finish. Listening scenario: garage rehearsal, driving, workout. Production profile: live band, punchy analog rock mix, real amps, no synths, no electronic drums. Fully instrumental.

Arrangement:

Primary: lead electric guitar (overdriven tube amp), rhythm electric guitar (crunchy power chords), electric bass, live drum kit. Secondary: light Hammond organ pad under the choruses, tambourine.

Section evolution: intro is the main riff on guitar with drum fill entry; first instrumental locks the full band into the groove; solo section drops the rhythm guitar back so the lead can climb with bends, vibrato, and fast runs; second instrumental returns to the main riff heavier; outro ends on a big unison stop with a ringing sustained chord.

Groove: straight-ahead 4/4 rock, tight but not quantized. Bass: driving 8th notes locked to the kick. Percussion: hard backbeat on 2 and 4, ride in the solo, crash accents on section changes. Textures: amp grit, string noise, room ambience. Spatial: rhythm guitars hard-panned left and right, lead centered, drums natural stereo, short plate reverb.

Lyrics:

[instrumental]`

// The "how do I prompt" FAQ answer is multi-line with bullets, so it lives in
// flush-left template literals to keep code indentation out of the rendered
// text (the accordion renders it with `white-space: pre-line`).
const howToPromptAnswerEn = `The model accepts two complementary inputs:

• Lyrics: define the words to be sung and may include explicit section tags such as [Intro], [Verse], [Pre-Chorus], [Chorus], [Post-Chorus], [Bridge], [Instrumental], [Solo], and [Outro].
• Music description: defines the musical style, emotional progression, vocal performance, instrumentation, arrangement, and production profile.
For precise control, we recommend using a Structured Caption with three sections:

• Global Metadata: genre, subgenre, BPM, key, scale, emotional progression, listening scenario, and production profile.
• Vocal Details: vocal gender, timbre, performance style, harmony, backing vocals, and vocal effects.
• Arrangement: primary and secondary instruments, section-level instrument evolution, groove, bass, percussion, textures, and spatial effects.
This representation allows the model to follow not only a global style, but also the musical development of the song over time.`

const howToPromptAnswerZh = `该模型接受两种互补的输入：

• 歌词（Lyrics）：定义要演唱的文字，可以包含明确的段落标记，例如 [Intro]、[Verse]、[Pre-Chorus]、[Chorus]、[Post-Chorus]、[Bridge]、[Instrumental]、[Solo] 和 [Outro]。
• 音乐描述（Music description）：定义音乐风格、情绪演变、人声表现、配器、编曲和制作风格。
如需精确控制，我们建议使用包含三个部分的结构化描述（Structured Caption）：

• 全局元数据（Global Metadata）：流派、子流派、BPM、调、音阶、情绪演变、聆听场景和制作风格。
• 人声细节（Vocal Details）：人声性别、音色、演唱风格、和声、伴唱和人声音效。
• 编曲（Arrangement）：主要和次要乐器、各段落的乐器演变、律动、贝斯、打击乐、织体和空间音效。
这种表示方式让模型不仅能遵循整体风格，还能遵循歌曲随时间展开的音乐发展。`

// The ComfyUI tutorial for generating music with MiniMax Music 3. Both the hero
// and the steps section point here so a visitor can jump straight to the guide.
const TUTORIAL_HREF =
  'https://docs.comfy.org/tutorials/audio/minimax/minimax-music-3#minimax-music-3-in-comfyui-ai-music-generation'

const CLOUD_RUN_HREF = 'https://cloud.comfy.org/?template=audio_minimax_music_3'

export const minimaxMusic3Page: ModelLaunchPage = {
  metaTitleKey: 'minimaxMusic3.meta.title',
  metaDescriptionKey: 'minimaxMusic3.meta.description',
  breadcrumbLabelKey: 'minimaxMusic3.breadcrumb.model',
  breadcrumbUpdatedKey: 'minimaxMusic3.breadcrumb.updated',
  hero: {
    videoSrc:
      'https://media.comfy.org/website/minimax-music-3/16x9-option-01_v2.mp4',
    posterSrc:
      'https://media.comfy.org/website/minimax-music-3/16x9-thumb-01.jpeg',
    titleKey: 'minimaxMusic3.hero.titleModel',
    titleRestKey: 'minimaxMusic3.hero.titleRest',
    descriptionKey: 'minimaxMusic3.hero.description',
    primaryCta: {
      labelKey: 'minimaxMusic3.hero.primaryCta',
      href: CLOUD_RUN_HREF,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'minimaxMusic3.hero.secondaryCta',
      href: TUTORIAL_HREF,
      target: '_blank'
    },
    badgeKeys: [
      'minimaxMusic3.hero.tagOpenWeights',
      'minimaxMusic3.hero.tagTextToMusic'
    ]
  },
  // Music leads with the tracks, then how-to, before pricing and Q&A. The video
  // pages keep the DEFAULT_SECTION_ORDER (steps after the Q&A).
  sectionOrder: ['audioGallery', 'steps', 'pricing', 'faq'],
  audioGallery: {
    cards: [
      {
        id: 'sample-01',
        description: {
          en: 'Gospel Soul',
          'zh-CN': '福音灵魂乐'
        },
        prompt: {
          en: gospelSoulPrompt,
          'zh-CN': gospelSoulPrompt
        },
        audioSources: [
          {
            src: 'https://media.comfy.org/website/minimax-music-3/audio_minimax_music3_00063.mp3',
            type: 'audio/mpeg'
          }
        ],
        posterSrc:
          'https://media.comfy.org/website/minimax-music-3/minimax-music3_cover.png'
      },
      {
        id: 'sample-02',
        description: {
          en: 'Rock (Instrumental)',
          'zh-CN': '摇滚（纯音乐）'
        },
        prompt: {
          en: rockInstrumentalPrompt,
          'zh-CN': rockInstrumentalPrompt
        },
        audioSources: [
          {
            src: 'https://media.comfy.org/website/minimax-music-3/audio_minimax_music3_00015.mp3',
            type: 'audio/mpeg'
          }
        ],
        posterSrc:
          'https://media.comfy.org/website/minimax-music-3/minimax-music3_cover.png'
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'minimaxMusic3.pricing.banner.title',
      subtitleKey: 'minimaxMusic3.pricing.banner.subtitle',
      cta: {
        labelKey: 'minimaxMusic3.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'minimaxMusic3.faq.heading',
    items: [
      {
        id: 'what-is-minimax-music-3',
        question: {
          en: 'What is MiniMax Music 3?',
          'zh-CN': 'MiniMax Music 3 是什么？'
        },
        answer: {
          en: 'An open weights music generation model that writes complete songs. Give it lyrics and a description of the sound, and it returns a finished track with vocals and full arrangement.',
          'zh-CN':
            '一款开源权重的音乐生成模型，能创作完整的歌曲。给它歌词和对声音的描述，它就会返回一首带人声和完整编曲的成品曲目。'
        }
      },
      {
        id: 'how-to-use',
        question: {
          en: 'How do I use MiniMax Music 3?',
          'zh-CN': '如何使用 MiniMax Music 3？'
        },
        answer: {
          en: 'The easiest way to try MiniMax Music 3 is to connect to Comfy Cloud, search the corresponding workflows in the example workflows and run them! To use the model locally, download Comfy Desktop, create a new ComfyUI instance or update an existing one, search MiniMax Music 3 in the example workflows, download the models and run.',
          'zh-CN':
            '体验 MiniMax Music 3 最简单的方式是连接 Comfy Cloud，在示例工作流中搜索对应的工作流并运行！若要在本地使用该模型，请下载 Comfy Desktop，新建一个 ComfyUI 实例或更新现有实例，在示例工作流中搜索 MiniMax Music 3，下载模型后运行。'
        }
      },
      {
        id: 'how-to-prompt',
        question: {
          en: 'How do I prompt MiniMax Music 3?',
          'zh-CN': '如何为 MiniMax Music 3 编写提示词？'
        },
        answer: {
          en: howToPromptAnswerEn,
          'zh-CN': howToPromptAnswerZh
        }
      },
      {
        id: 'song-length',
        question: {
          en: 'How long can MiniMax Music 3 songs be?',
          'zh-CN': 'MiniMax Music 3 生成的歌曲能有多长？'
        },
        answer: {
          en: 'Up to five minutes in a single generation. Structure holds across the full length, so melody, rhythm, and vocal identity stay consistent from intro to outro.',
          'zh-CN':
            '单次生成最长五分钟。结构在整首曲目中保持稳定，因此旋律、节奏和人声特征从前奏到尾声都保持一致。'
        }
      },
      {
        id: 'control-vocals',
        question: {
          en: 'Can I control the vocals?',
          'zh-CN': '我可以控制人声吗？'
        },
        answer: {
          en: 'Yes. You can set gender, timbre, performance style, harmony, backing vocals, and effects.',
          'zh-CN': '可以。你可以设定性别、音色、演唱风格、和声、伴唱以及音效。'
        }
      },
      {
        id: 'audio-quality',
        question: {
          en: 'What audio quality does MiniMax Music 3 output?',
          'zh-CN': 'MiniMax Music 3 输出的音频质量如何？'
        },
        answer: {
          en: '32 kHz, 16-bit stereo WAV.',
          'zh-CN': '32 kHz、16 位立体声 WAV。'
        }
      },
      {
        id: 'free-to-use',
        question: {
          en: 'Is MiniMax Music 3 free to use?',
          'zh-CN': 'MiniMax Music 3 可以免费使用吗？'
        },
        answer: {
          en: 'Yes. MiniMax Music 3 is open weight under the [MiniMax Community License](https://huggingface.co/MiniMaxAI/MiniMax-Music3/blob/main/LICENSE), free to use, including commercially, for companies under 20 million US dollars in yearly revenue.',
          'zh-CN':
            '可以。MiniMax Music 3 依据 [MiniMax 社区许可](https://huggingface.co/MiniMaxAI/MiniMax-Music3/blob/main/LICENSE)提供开源权重，年收入低于 2000 万美元的公司可免费使用，包括商业用途。'
        }
      },
      {
        id: 'commercial-use',
        question: {
          en: 'Can I use MiniMax Music 3 commercially?',
          'zh-CN': '我可以将 MiniMax Music 3 用于商业用途吗？'
        },
        answer: {
          en: 'Yes, for companies under 20 million US dollars in yearly revenue, under the MiniMax Community License. Above that threshold you need MiniMax authorization, which [a MiniMax commercial license through Comfy](https://comfy.org/minimax/license) covers.',
          'zh-CN':
            '可以。依据 MiniMax 社区许可，年收入低于 2000 万美元的公司可以商用。超过该门槛需要 MiniMax 授权，[通过 Comfy 获取的 MiniMax 商业许可](https://comfy.org/zh-CN/minimax/license)即涵盖这一授权。'
        }
      }
    ]
  },
  steps: {
    headingKey: 'minimaxMusic3.steps.heading',
    stepLabelKey: 'minimaxMusic3.steps.step',
    primaryCta: {
      labelKey: 'minimaxMusic3.steps.primaryCta',
      href: CLOUD_RUN_HREF,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'minimaxMusic3.steps.secondaryCta',
      href: TUTORIAL_HREF,
      target: '_blank'
    },
    items: [
      {
        id: 'write-your-lyrics',
        title: { en: 'Write your lyrics', 'zh-CN': '写下你的歌词' },
        description: {
          en: 'Your words, or auto-written from a theme',
          'zh-CN': '用你自己的词，或根据主题自动生成'
        }
      },
      {
        id: 'describe-the-sound',
        title: { en: 'Describe the sound', 'zh-CN': '描述你想要的声音' },
        description: {
          en: 'Style, mood, instruments',
          'zh-CN': '风格、情绪、乐器'
        }
      },
      {
        id: 'generate-your-song',
        title: { en: 'Generate your song', 'zh-CN': '生成你的歌曲' },
        description: {
          en: 'Full track, up to five minutes',
          'zh-CN': '完整曲目，最长五分钟'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'minimaxMusic3.runOptions.heading',
    subtitleKey: 'minimaxMusic3.runOptions.subtitle',
    ctaKey: 'minimaxMusic3.runOptions.cta'
  },
  reviews: {
    headingKey: 'minimaxMusic3.reviews.heading',
    highlight: {
      titleKey: 'minimaxMusic3.reviews.highlightTitle',
      descriptionKey: 'minimaxMusic3.reviews.highlightDescription',
      ctaKey: 'minimaxMusic3.reviews.highlightCta',
      route: 'minimaxLicense'
    }
  }
}
