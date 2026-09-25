import type { Locale } from '../../../i18n/translations'

export function videoStarterCopy(locale: Locale = 'en') {
  return locale === 'zh-CN'
    ? {
        title: '让你的场景动起来',
        body: '从一个镜头开始。选择示例来填写提示词，或为自己的图像添加动作。',
        hint: '提示词示例 · 点击后可编辑，不会立即生成',
        animate: '让你的图像动起来',
        animateHint: '以自己的画面为起点，设计主体和镜头的动作。',
        upload: '选择起始图像',
        saved: '从作品中选择',
        placeholder: '什么在动？描述动作，以及镜头如何跟随。',
        referenceHint: '此模型需要起始图像。添加图像后，即可预览生成请求。'
      }
    : {
        title: 'Bring your scene to life.',
        body: 'Start with one shot. Try a motion prompt, or bring movement to your own image.',
        hint: 'Prompt starters · Fill, edit, then review',
        animate: 'Animate your image',
        animateHint:
          'Start with your own frame. Direct the subject and the camera.',
        upload: 'Choose a starting image',
        saved: 'Choose from your creations',
        placeholder:
          'What moves? Describe the action and how the camera follows.',
        referenceHint:
          'This model needs a starting image. Add one before reviewing your shot.'
      }
}

export function videoStarters(locale: Locale = 'en') {
  const zh = locale === 'zh-CN'
  return [
    {
      id: 'push-in',
      image: '/images/cinematic-studio/portrait.jpg',
      label: zh ? '缓慢推进' : 'Slow cinematic push-in',
      detail: zh
        ? '靠近主体，捕捉细微动作。'
        : 'Move closer. Let a small gesture tell the story.',
      scene: zh
        ? '一位老渔夫站在阴天的码头上，手里拿着一卷绳索。镜头缓慢向他的脸推进，他抬起目光。保持单个连续镜头。'
        : 'An old fisherman stands on an overcast pier holding a coil of rope. The camera slowly pushes toward his face as he raises his gaze. Keep one continuous shot.',
      motion: zh
        ? '保持起始画面的主体和环境。镜头缓慢向主体推进，捕捉一个细微的自然动作。保持单个连续镜头。'
        : 'Preserve the subject and setting of the starting frame. Slowly push the camera toward the subject as a small, natural gesture unfolds. Keep one continuous shot.'
    },
    {
      id: 'follow',
      image: '/images/cinematic-studio/desert.jpg',
      label: zh ? '跟随移动的主体' : 'Follow a moving subject',
      detail: zh
        ? '与主体同步，平稳跟拍。'
        : 'Match the pace with a steady tracking shot.',
      scene: zh
        ? '黎明时，一名骑手缓缓穿越沙丘。镜头从侧面与马匹平行跟拍，保持骑手在画面中的大小稳定，背景沙丘缓缓掠过。保持单个连续镜头。'
        : 'At dawn, a lone rider travels slowly across the dunes. Track alongside the horse, keeping the rider a steady size as the dunes pass behind. Keep one continuous shot.',
      motion: zh
        ? '保持起始画面的主体和环境。主体向前移动时，镜头以相同速度平稳跟随，保持取景一致。保持单个连续镜头。'
        : 'Preserve the subject and setting of the starting frame. Track smoothly with the subject as it moves forward, matching its pace and keeping the framing consistent. Keep one continuous shot.'
    },
    {
      id: 'reveal',
      image: '/images/cinematic-studio/train.jpg',
      label: zh ? '展现辽阔风景' : 'Reveal a landscape',
      detail: zh
        ? '从细节移向更广阔的世界。'
        : 'Shift from an intimate detail to the wider world.',
      scene: zh
        ? '蓝调时刻，一位旅客望向夜行列车的窗外。镜头从她的侧脸缓慢平移到车窗，展现经过的雪山。保持单个连续镜头。'
        : 'At blue hour, a traveler looks out of a night train window. Pan slowly from her profile to the window, revealing snowy mountains passing outside. Keep one continuous shot.',
      motion: zh
        ? '保持起始画面的主体和环境。镜头缓慢后移，逐步展现周围的景色，保持主体不变。保持单个连续镜头。'
        : 'Preserve the subject and setting of the starting frame. Pull the camera back slowly to reveal more of the surrounding landscape, keeping the subject consistent. Keep one continuous shot.'
    }
  ] as const
}
