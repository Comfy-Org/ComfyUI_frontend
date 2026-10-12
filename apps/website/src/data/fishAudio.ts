import type { ModelLaunchPage } from '@/templates/model-launch/types'

import { externalLinks } from '@/config/routes'

const narrationPrompt = `[warm, unhurried] Every image starts as noise. [short pause] The sampler decides how to walk from there.
[soft tone] That walk is yours to design. [sighing] And once the graph is built, [excited] the queue runs on its own.`

const dialoguePrompt = `@Voice1 [nervous] You're sure no one followed you?
@Voice2 [calm] Positive. [short pause] I took the long way round.
@Voice1 [relieved] Good. [whispering] Then let's get this done before the lights come back on.
@Voice2 [chuckling] Ha, ha. After you.`

const howToDirectAnswerEn = `Put the direction in square brackets, right in the script. A tag applies from where it sits until the next tag or the end of the sentence.

• Emotion: [happy], [sad], [angry], [excited], [calm], [sarcastic]
• Tone: [whispering], [shouting], [soft tone], [emphasis] before the word to stress
• Sounds: [laughing], [sighing], [gasping], [clear throat]
• Pacing: [break], [long-break], [short pause], [long pause]
Free-form descriptions work too, such as [tired, end of a long shift] or [professional broadcast tone]. Keep to one primary emotion per sentence and three tags or fewer, and write the tags in the script's own language.`

const howToDirectAnswerZh = `把表演指令写在方括号里，直接放进台词。一个标签从它所在的位置开始生效，直到下一个标签或句子结束。

• 情绪：[happy]、[sad]、[angry]、[excited]、[calm]、[sarcastic]
• 语气：[whispering]、[shouting]、[soft tone]，以及放在重读词之前的 [emphasis]
• 声音：[laughing]、[sighing]、[gasping]、[clear throat]
• 节奏：[break]、[long-break]、[short pause]、[long pause]
也可以用自由描述，例如 [tired, end of a long shift] 或 [professional broadcast tone]。每句话保持一个主要情绪、不超过三个标签，标签可以用台词本身的语言书写。`

const TUTORIAL_HREF =
  'https://docs.comfy.org/tutorials/partner-nodes/fishaudio/fish-audio'

const PROMPT_GUIDE_HREF =
  'https://docs.comfy.org/tutorials/partner-nodes/fishaudio/prompt-guide'

const CLOUD_RUN_HREF =
  'https://cloud.comfy.org/?template=api_fishaudio_text_to_speech'

const CLOUD_VOICE_CLONE_HREF =
  'https://cloud.comfy.org/?template=api_fishaudio_voice_clone_tts'

export const fishAudioPage: ModelLaunchPage = {
  metaTitleKey: 'fishAudio.meta.title',
  metaDescriptionKey: 'fishAudio.meta.description',
  breadcrumbLabelKey: 'fishAudio.breadcrumb.model',
  breadcrumbUpdatedKey: 'fishAudio.breadcrumb.updated',
  hero: {
    titleKey: 'fishAudio.hero.titleModel',
    titleRestKey: 'fishAudio.hero.titleRest',
    descriptionKey: 'fishAudio.hero.description',
    primaryCta: {
      labelKey: 'fishAudio.hero.primaryCta',
      href: CLOUD_RUN_HREF,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'fishAudio.hero.secondaryCta',
      href: TUTORIAL_HREF,
      target: '_blank'
    },
    badgeKeys: [
      'fishAudio.hero.tagPartnerNode',
      'fishAudio.hero.tagTextToSpeech',
      'fishAudio.hero.tagVoiceCloning'
    ]
  },
  sectionOrder: ['audioGallery', 'steps', 'pricing', 'faq'],
  audioGallery: {
    cards: [
      {
        id: 'sample-01',
        description: {
          en: 'Narration with inline direction',
          'zh-CN': '带内嵌表演指令的旁白'
        },
        prompt: {
          en: narrationPrompt,
          'zh-CN': narrationPrompt
        },
        audioSources: [
          {
            src: 'https://media.comfy.org/website/workshop/fishaudio/text-to-speech/sigh-yes-voice-generated-excited.mp3',
            type: 'audio/mpeg'
          }
        ],
        posterSrc: '/images/models/fish-audio-placeholder.webp'
      },
      {
        id: 'sample-02',
        description: {
          en: 'Two-speaker dialogue',
          'zh-CN': '双人对话'
        },
        prompt: {
          en: dialoguePrompt,
          'zh-CN': dialoguePrompt
        },
        audioSources: [
          {
            src: 'https://media.comfy.org/website/workshop/fishaudio/text-to-speech/sigh-yes-voice-generated-excited.mp3',
            type: 'audio/mpeg'
          }
        ],
        posterSrc: '/images/models/fish-audio-voice-clone-placeholder.webp'
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'fishAudio.pricing.banner.title',
      subtitleKey: 'fishAudio.pricing.banner.subtitle',
      cta: {
        labelKey: 'fishAudio.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'fishAudio.faq.heading',
    items: [
      {
        id: 'what-is-fish-audio',
        question: {
          en: 'What is Fish Audio S2.1 Pro?',
          'zh-CN': 'Fish Audio S2.1 Pro 是什么？'
        },
        answer: {
          en: 'A text to speech model that takes direction. Write the script, mark the delivery with inline tags, and it returns expressive speech in 80+ languages. The same family of nodes clones a voice from a few short clips and transcribes audio back to text.',
          'zh-CN':
            '一款听得懂指令的文本转语音模型。写下台词，用内嵌标签标出表演方式，它就能返回 80 多种语言的富有表现力的语音。同一组节点还能用几段短录音克隆声音，并把音频转写回文字。'
        }
      },
      {
        id: 'how-to-use',
        question: {
          en: 'How do I use Fish Audio in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中使用 Fish Audio？'
        },
        answer: {
          en: 'The quickest route is Comfy Cloud: open the Fish Audio text to speech template, type your script, and run. Locally, the Fish Audio nodes ship with ComfyUI under partner, audio, Fish Audio: Text to Speech, Speech to Text, Voice Selector, and Instant Voice Clone. Sign in to your ComfyUI account and they bill per use. The voice clone and speech to text templates need ComfyUI 0.34.0 or newer.',
          'zh-CN':
            '最快的方式是 Comfy Cloud：打开 Fish Audio 文本转语音模板，输入台词，运行即可。在本地，Fish Audio 节点随 ComfyUI 一同提供，位于 partner、audio、Fish Audio 下：Text to Speech、Speech to Text、Voice Selector 和 Instant Voice Clone。登录 ComfyUI 账号后按使用量计费。声音克隆和语音转文字模板需要 ComfyUI 0.34.0 或更新版本。'
        }
      },
      {
        id: 'how-to-direct',
        question: {
          en: 'How do I direct the voice?',
          'zh-CN': '如何指导声音的表演？'
        },
        answer: {
          en: howToDirectAnswerEn,
          'zh-CN': howToDirectAnswerZh
        }
      },
      {
        id: 'voice-cloning',
        question: {
          en: 'Can I clone a voice?',
          'zh-CN': '我可以克隆声音吗？'
        },
        answer: {
          en: 'Yes. Record two or three clips of 15 to 20 seconds each, under 270 seconds in total, and connect them to the Instant Voice Clone node. The cloned voice feeds straight into text to speech with no training wait. One speaker, a quiet room, and steady tone give the best result. Clone only voices you have permission to use.',
          'zh-CN':
            '可以。录制两到三段各 15 到 20 秒的音频，总时长不超过 270 秒，连接到 Instant Voice Clone 节点即可。克隆出的声音直接接入文本转语音，无需等待训练。单人、安静的环境和稳定的语气效果最好。请只克隆你有权使用的声音。'
        }
      },
      {
        id: 'multi-speaker',
        question: {
          en: 'Can I write a scene with more than one voice?',
          'zh-CN': '我可以写多个声音的对话场景吗？'
        },
        answer: {
          en: 'Yes. Connect up to five voices to the Text to Speech node and mark each line with @Voice1, @Voice2, and so on. Every connected voice has to appear in the script at least once. The whole scene renders in one generation.',
          'zh-CN':
            '可以。最多把五个声音连接到 Text to Speech 节点，并用 @Voice1、@Voice2 等标记每一句台词。每个接入的声音都必须在台词中至少出现一次。整个场景在一次生成中完成。'
        }
      },
      {
        id: 'speech-to-text',
        question: {
          en: 'Does it transcribe audio too?',
          'zh-CN': '它也能把音频转成文字吗？'
        },
        answer: {
          en: 'Yes. The Speech to Text node detects the language automatically across 80+ languages and returns the text, the language code, and optional word-level timestamps as JSON, ready for subtitles or for turning a recording into a prompt.',
          'zh-CN':
            '可以。Speech to Text 节点能在 80 多种语言中自动识别语言，返回文字、语言代码，以及可选的逐词时间戳 JSON，可直接用于字幕，或把录音变成提示词。'
        }
      },
      {
        id: 'pricing',
        question: {
          en: 'How is Fish Audio priced?',
          'zh-CN': 'Fish Audio 如何计费？'
        },
        answer: {
          en: `Per use, through your ComfyUI account. Text to speech is metered by the length of the script, speech to text by the minute, and voice cloning is free. Current rates are listed in the [Fish Audio docs](${TUTORIAL_HREF}).`,
          'zh-CN': `通过你的 ComfyUI 账号按使用量计费。文本转语音按台词长度计量，语音转文字按分钟计量，声音克隆免费。当前费率见 [Fish Audio 文档](${TUTORIAL_HREF})。`
        }
      },
      {
        id: 'open-weights',
        question: {
          en: 'Is Fish Audio S2.1 Pro open weights?',
          'zh-CN': 'Fish Audio S2.1 Pro 是开源权重吗？'
        },
        answer: {
          en: `No. S2.1 Pro runs through the Fish Audio API as a partner node, so there is nothing to download and no GPU to provision. The legacy S1 model is also available from the same node. See the [prompt guide](${PROMPT_GUIDE_HREF}) for the tag differences between the two.`,
          'zh-CN': `不是。S2.1 Pro 作为合作伙伴节点通过 Fish Audio API 运行，无需下载模型，也无需配置 GPU。旧版 S1 模型也可在同一节点中选用。两者的标签差异见[提示词指南](${PROMPT_GUIDE_HREF})。`
        }
      }
    ]
  },
  steps: {
    headingKey: 'fishAudio.steps.heading',
    stepLabelKey: 'fishAudio.steps.step',
    primaryCta: {
      labelKey: 'fishAudio.steps.primaryCta',
      href: CLOUD_RUN_HREF,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'fishAudio.steps.secondaryCta',
      href: CLOUD_VOICE_CLONE_HREF,
      target: '_blank'
    },
    items: [
      {
        id: 'write-the-script',
        title: { en: 'Write the script', 'zh-CN': '写下台词' },
        description: {
          en: 'Your words, with [tags] where the delivery turns',
          'zh-CN': '你的文字，在表演转折处加上 [标签]'
        }
      },
      {
        id: 'pick-a-voice',
        title: { en: 'Pick or clone a voice', 'zh-CN': '选择或克隆声音' },
        description: {
          en: 'A curated voice, or two short clips of your own',
          'zh-CN': '精选声音，或你自己的两段短录音'
        }
      },
      {
        id: 'generate-the-speech',
        title: { en: 'Generate the speech', 'zh-CN': '生成语音' },
        description: {
          en: 'One audio output, ready to route into video',
          'zh-CN': '一段音频输出，可直接接入视频'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'fishAudio.runOptions.heading',
    subtitleKey: 'fishAudio.runOptions.subtitle',
    ctaKey: 'fishAudio.runOptions.cta'
  },
  reviews: {
    headingKey: 'fishAudio.reviews.heading',
    highlight: {
      titleKey: 'fishAudio.reviews.highlightTitle',
      descriptionKey: 'fishAudio.reviews.highlightDescription',
      ctaKey: 'fishAudio.reviews.highlightCta'
    }
  }
}
