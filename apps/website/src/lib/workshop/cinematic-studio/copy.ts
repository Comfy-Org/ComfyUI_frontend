import type { Locale, LocalizedText } from '../../../i18n/translations'

/**
 * Copy for the Cinematic Studio only. It stays out of the site-wide
 * translations module so the studio's strings ship with the studio and do
 * not add to every other page's script budget.
 */
const copy = {
  'cinematic.ux.heading': {
    en: 'Layout to review',
    'zh-CN': '评审布局'
  },
  'cinematic.ux.composer': {
    en: 'E · Bottom composer',
    'zh-CN': 'E · 底部输入栏'
  },
  'cinematic.ux.panel': {
    en: 'D · Side panel',
    'zh-CN': 'D · 侧边面板'
  },
  'cinematic.panel.label': {
    en: 'Shot settings',
    'zh-CN': '镜头设置'
  },
  'cinematic.section.output': {
    en: 'Format',
    'zh-CN': '画幅'
  },
  'cinematic.section.direction': {
    en: 'Direction',
    'zh-CN': '导演'
  },
  'cinematic.scene.fullPrompt': {
    en: 'View full prompt',
    'zh-CN': '查看完整提示词'
  },
  'cinematic.scene.edit': {
    en: 'Edit scene',
    'zh-CN': '编辑场景'
  },
  'cinematic.reference.optional': {
    en: 'Optional',
    'zh-CN': '可选'
  },
  'cinematic.stage.emptyTitle': {
    en: 'Your first shot appears here',
    'zh-CN': '你的第一个镜头会显示在这里'
  },
  'cinematic.stage.emptyBody': {
    en: 'Write a scene, set the direction, then Generate.',
    'zh-CN': '写下场景，设置导演选项，然后点击生成。'
  },
  'cinematic.title': {
    en: 'Cinematic Studio',
    'zh-CN': '电影工作室'
  },
  'cinematic.beta': {
    en: 'Beta',
    'zh-CN': '测试版'
  },
  'cinematic.meta.description': {
    en: 'Direct cinematic stills: pick the camera, shot, light, film and grade, then run any image model through the Comfy Router.',
    'zh-CN':
      '导演电影感静帧：选择摄影机、景别、光线、胶片与调色，然后通过 Comfy Router 运行任意图像模型。'
  },
  'cinematic.unavailable.title': {
    en: 'Cinematic Studio is not open yet',
    'zh-CN': '电影工作室尚未开放'
  },
  'cinematic.unavailable.link': {
    en: 'Browse models',
    'zh-CN': '浏览模型'
  },
  'cinematic.model.heading': {
    en: 'Model · via Comfy Router',
    'zh-CN': '模型 · 通过 Comfy Router'
  },
  'cinematic.composer.label': {
    en: 'Direct the shot',
    'zh-CN': '导演镜头'
  },
  'cinematic.composer.references': {
    en: 'Add a reference image',
    'zh-CN': '添加参考图'
  },
  'cinematic.composer.format': {
    en: 'Format',
    'zh-CN': '画幅'
  },
  'cinematic.firstRun.body': {
    en: 'Describe the moment. Pick the camera, the light and the look. Switch models any time.',
    'zh-CN': '描述这一刻。选择摄影机、光线与风格。随时切换模型。'
  },
  'cinematic.firstRun.desert': {
    en: 'Lone rider crossing dunes at dawn',
    'zh-CN': '黎明时分独自穿越沙丘的骑手'
  },
  'cinematic.firstRun.portrait': {
    en: 'Old fisherman on an overcast pier',
    'zh-CN': '阴天码头上的老渔夫'
  },
  'cinematic.firstRun.train': {
    en: 'Night train window at blue hour',
    'zh-CN': '蓝调时刻的夜车车窗'
  },
  'cinematic.section.scene': {
    en: 'Scene',
    'zh-CN': '场景'
  },
  'cinematic.section.camera': {
    en: 'Camera',
    'zh-CN': '摄影机'
  },
  'cinematic.section.references': {
    en: 'References',
    'zh-CN': '参考'
  },
  'cinematic.scene.placeholder': {
    en: 'Describe the moment. Who, where, what is happening.',
    'zh-CN': '描述这一刻：谁、在哪里、发生了什么。'
  },
  'cinematic.scene.enhance': {
    en: 'AI prompt',
    'zh-CN': 'AI 提示词'
  },
  'cinematic.scene.enhanceHint': {
    en: 'Adds “cinematic film still” to the prompt',
    'zh-CN': '在提示词中加入“电影静帧”描述'
  },
  'cinematic.camera.body': {
    en: 'Body',
    'zh-CN': '机身'
  },
  'cinematic.camera.lens': {
    en: 'Lens',
    'zh-CN': '镜头'
  },
  'cinematic.camera.focal': {
    en: 'Focal length',
    'zh-CN': '焦距'
  },
  'cinematic.camera.aperture': {
    en: 'Aperture',
    'zh-CN': '光圈'
  },
  'cinematic.part.shot': {
    en: 'Shot',
    'zh-CN': '景别'
  },
  'cinematic.part.light': {
    en: 'Light',
    'zh-CN': '光线'
  },
  'cinematic.part.film': {
    en: 'Film',
    'zh-CN': '胶片'
  },
  'cinematic.part.look': {
    en: 'Look',
    'zh-CN': '风格'
  },
  'cinematic.part.grade': {
    en: 'Grade',
    'zh-CN': '调色'
  },
  'cinematic.option.auto': {
    en: 'Auto',
    'zh-CN': '自动'
  },
  'cinematic.option.digital': {
    en: 'Digital cinema',
    'zh-CN': '数字电影机'
  },
  'cinematic.option.largeFormat': {
    en: 'Large format',
    'zh-CN': '大画幅'
  },
  'cinematic.option.super35': {
    en: 'Super 35',
    'zh-CN': 'Super 35'
  },
  'cinematic.option.film35': {
    en: '35mm film',
    'zh-CN': '35mm 胶片'
  },
  'cinematic.option.film16': {
    en: '16mm film',
    'zh-CN': '16mm 胶片'
  },
  'cinematic.option.handheld': {
    en: 'Handheld',
    'zh-CN': '手持'
  },
  'cinematic.option.prime': {
    en: 'Spherical prime',
    'zh-CN': '球面定焦'
  },
  'cinematic.option.anamorphic': {
    en: 'Anamorphic',
    'zh-CN': '变形宽银幕'
  },
  'cinematic.option.vintage': {
    en: 'Vintage',
    'zh-CN': '复古镜头'
  },
  'cinematic.option.macro': {
    en: 'Macro',
    'zh-CN': '微距'
  },
  'cinematic.option.tiltShift': {
    en: 'Tilt-shift',
    'zh-CN': '移轴'
  },
  'cinematic.option.mm14': {
    en: '14mm',
    'zh-CN': '14mm'
  },
  'cinematic.option.mm24': {
    en: '24mm',
    'zh-CN': '24mm'
  },
  'cinematic.option.mm35': {
    en: '35mm',
    'zh-CN': '35mm'
  },
  'cinematic.option.mm50': {
    en: '50mm',
    'zh-CN': '50mm'
  },
  'cinematic.option.mm85': {
    en: '85mm',
    'zh-CN': '85mm'
  },
  'cinematic.option.mm135': {
    en: '135mm',
    'zh-CN': '135mm'
  },
  'cinematic.option.f14': {
    en: 'f/1.4',
    'zh-CN': 'f/1.4'
  },
  'cinematic.option.f2': {
    en: 'f/2',
    'zh-CN': 'f/2'
  },
  'cinematic.option.f28': {
    en: 'f/2.8',
    'zh-CN': 'f/2.8'
  },
  'cinematic.option.f4': {
    en: 'f/4',
    'zh-CN': 'f/4'
  },
  'cinematic.option.f8': {
    en: 'f/8',
    'zh-CN': 'f/8'
  },
  'cinematic.option.extremeWide': {
    en: 'Extreme wide',
    'zh-CN': '大远景'
  },
  'cinematic.option.wide': {
    en: 'Wide',
    'zh-CN': '远景'
  },
  'cinematic.option.medium': {
    en: 'Medium',
    'zh-CN': '中景'
  },
  'cinematic.option.closeUp': {
    en: 'Close-up',
    'zh-CN': '特写'
  },
  'cinematic.option.extremeCloseUp': {
    en: 'Extreme close-up',
    'zh-CN': '大特写'
  },
  'cinematic.option.overShoulder': {
    en: 'Over the shoulder',
    'zh-CN': '过肩镜头'
  },
  'cinematic.option.lowAngle': {
    en: 'Low angle',
    'zh-CN': '仰拍'
  },
  'cinematic.option.goldenHour': {
    en: 'Golden hour',
    'zh-CN': '黄金时刻'
  },
  'cinematic.option.overcast': {
    en: 'Overcast',
    'zh-CN': '阴天'
  },
  'cinematic.option.blueHour': {
    en: 'Blue hour',
    'zh-CN': '蓝调时刻'
  },
  'cinematic.option.practicalNight': {
    en: 'Practical night',
    'zh-CN': '实景夜光'
  },
  'cinematic.option.neon': {
    en: 'Neon',
    'zh-CN': '霓虹'
  },
  'cinematic.option.lowKey': {
    en: 'Low key',
    'zh-CN': '低调光'
  },
  'cinematic.option.silhouette': {
    en: 'Silhouette',
    'zh-CN': '剪影'
  },
  'cinematic.option.digitalClean': {
    en: 'Digital clean',
    'zh-CN': '纯净数字'
  },
  'cinematic.option.tungsten500': {
    en: 'Tungsten 500T',
    'zh-CN': '钨丝灯 500T'
  },
  'cinematic.option.daylight250': {
    en: 'Daylight 250D',
    'zh-CN': '日光 250D'
  },
  'cinematic.option.blackWhite400': {
    en: 'Black & white 400',
    'zh-CN': '黑白 400'
  },
  'cinematic.option.reversal': {
    en: 'Reversal slide',
    'zh-CN': '反转片'
  },
  'cinematic.option.expired': {
    en: 'Expired film',
    'zh-CN': '过期胶片'
  },
  'cinematic.option.bleachBypass': {
    en: 'Bleach bypass',
    'zh-CN': '漂白效果'
  },
  'cinematic.option.neoNoir': {
    en: 'Neo-noir',
    'zh-CN': '新黑色电影'
  },
  'cinematic.option.western': {
    en: 'Western',
    'zh-CN': '西部片'
  },
  'cinematic.option.sciFi': {
    en: 'Science fiction',
    'zh-CN': '科幻'
  },
  'cinematic.option.periodDrama': {
    en: 'Period drama',
    'zh-CN': '年代剧'
  },
  'cinematic.option.thriller': {
    en: 'Thriller',
    'zh-CN': '惊悚片'
  },
  'cinematic.option.documentary': {
    en: 'Documentary',
    'zh-CN': '纪录片'
  },
  'cinematic.option.roadMovie': {
    en: 'Road movie',
    'zh-CN': '公路片'
  },
  'cinematic.option.tealOrange': {
    en: 'Teal and orange',
    'zh-CN': '青橙色调'
  },
  'cinematic.option.noir': {
    en: 'Noir',
    'zh-CN': '黑白'
  },
  'cinematic.option.kodachrome': {
    en: 'Kodachrome',
    'zh-CN': '柯达克罗姆'
  },
  'cinematic.option.neonNight': {
    en: 'Neon night',
    'zh-CN': '霓虹之夜'
  },
  'cinematic.option.desertDust': {
    en: 'Desert dust',
    'zh-CN': '沙漠尘土'
  },
  'cinematic.option.nordicCold': {
    en: 'Nordic cold',
    'zh-CN': '北欧冷调'
  },
  'cinematic.aspect.scope': {
    en: 'Scope',
    'zh-CN': '宽银幕'
  },
  'cinematic.aspect.widescreen': {
    en: 'Widescreen',
    'zh-CN': '宽屏'
  },
  'cinematic.aspect.academy': {
    en: 'Academy',
    'zh-CN': '学院比例'
  },
  'cinematic.aspect.square': {
    en: 'Square',
    'zh-CN': '方形'
  },
  'cinematic.aspect.vertical': {
    en: 'Vertical',
    'zh-CN': '竖屏'
  },
  'cinematic.reference.cast': {
    en: 'Character',
    'zh-CN': '角色'
  },
  'cinematic.reference.castHint': {
    en: 'Same face across shots',
    'zh-CN': '在各镜头中保持同一张脸'
  },
  'cinematic.reference.castAction': {
    en: 'Add a character reference',
    'zh-CN': '添加角色参考'
  },
  'cinematic.reference.palette': {
    en: 'Palette',
    'zh-CN': '色板'
  },
  'cinematic.reference.paletteHint': {
    en: 'Match its colors',
    'zh-CN': '匹配其色彩'
  },
  'cinematic.reference.paletteAction': {
    en: 'Add a palette reference',
    'zh-CN': '添加色板参考'
  },
  'cinematic.reference.remove': {
    en: 'Remove reference',
    'zh-CN': '移除参考'
  },
  'cinematic.picker.close': {
    en: 'Close',
    'zh-CN': '关闭'
  },
  'cinematic.output.takes': {
    en: 'Takes',
    'zh-CN': '条数'
  },
  'cinematic.output.fewerTakes': {
    en: 'Fewer takes',
    'zh-CN': '减少条数'
  },
  'cinematic.output.moreTakes': {
    en: 'More takes',
    'zh-CN': '增加条数'
  },
  'cinematic.output.aspect': {
    en: 'Aspect ratio',
    'zh-CN': '画面比例'
  },
  'cinematic.output.resolution': {
    en: 'Resolution',
    'zh-CN': '分辨率'
  },
  'cinematic.output.generate': {
    en: 'Generate',
    'zh-CN': '生成'
  },
  'cinematic.output.cancel': {
    en: 'Cancel',
    'zh-CN': '取消'
  },
  'cinematic.output.unavailable': {
    en: 'Running models is not available here yet.',
    'zh-CN': '此处暂不支持运行模型。'
  },
  'cinematic.stage.label': {
    en: 'Shots',
    'zh-CN': '镜头'
  },
  'cinematic.stage.rendering': {
    en: 'Rendering…',
    'zh-CN': '渲染中…'
  },
  'cinematic.stage.shot': {
    en: 'Shot {number}',
    'zh-CN': '镜头 {number}'
  },
  'cinematic.stage.takes': {
    en: 'Takes',
    'zh-CN': '条数'
  },
  'cinematic.stage.download': {
    en: 'Download',
    'zh-CN': '下载'
  },
  'cinematic.stage.sequence': {
    en: 'Sequence',
    'zh-CN': '序列'
  },
  'cinematic.stage.thumb': {
    en: 'Shot {shot}, take {take}',
    'zh-CN': '镜头 {shot}，第 {take} 条'
  }
} as const satisfies Record<string, LocalizedText>

export type CinematicCopyKey = keyof typeof copy

export function tc(key: CinematicCopyKey, locale: Locale = 'en'): string {
  const entry: LocalizedText = copy[key]
  return entry[locale] ?? entry.en
}
