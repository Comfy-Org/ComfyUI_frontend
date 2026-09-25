import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  'reshoot.title': { en: 'Re-shoot a video', 'zh-CN': '重拍视频' },
  'reshoot.prototype': { en: 'Prototype', 'zh-CN': '原型' },
  'reshoot.panel': { en: 'Re-shoot settings', 'zh-CN': '重拍设置' },
  'reshoot.section.video': { en: 'Video', 'zh-CN': '视频' },
  'reshoot.step': { en: 'Step {n}', 'zh-CN': '第 {n} 步' },
  'reshoot.step1': { en: 'Prepare the clip', 'zh-CN': '准备片段' },
  'reshoot.step2': { en: 'Aim and generate', 'zh-CN': '设置机位并生成' },
  'reshoot.step1.hint': {
    en: 'Choose the clip, its framing and what the new view should reveal. Depth is analyzed once; then you aim freely.',
    'zh-CN':
      '选择片段、画面比例以及新视角要呈现的内容。深度只需分析一次，之后可自由取景。'
  },
  'reshoot.step2.hint': {
    en: 'Drag the preview or use the controls, key a move if you want one, then generate.',
    'zh-CN': '拖动预览或使用控件，需要时添加关键帧运镜，然后生成。'
  },
  'reshoot.continue': { en: 'Continue', 'zh-CN': '继续' },
  'reshoot.back': { en: 'Back to the clip', 'zh-CN': '返回片段' },
  'reshoot.edit': { en: 'Edit', 'zh-CN': '编辑' },
  'reshoot.credit': {
    en: "Built on Cseti's CrossView-Warp LoRA and node",
    'zh-CN': '基于 Cseti 的 CrossView-Warp LoRA 与节点'
  },
  'reshoot.pick.lead': {
    en: 'Pick a clip, aim a new camera at it, and get the same moment from another angle.',
    'zh-CN': '选择一个片段，设置新的机位，从另一个角度得到同一时刻。'
  },
  'reshoot.pick.drop': { en: 'Drop a video here', 'zh-CN': '将视频拖到这里' },
  'reshoot.pick.upload': { en: 'Upload a video', 'zh-CN': '上传视频' },
  'reshoot.pick.exampleMeta': {
    en: 'Try it without uploading anything',
    'zh-CN': '无需上传即可试用'
  },
  'reshoot.aim.globe': {
    en: 'Hold and drag to aim the camera',
    'zh-CN': '按住并拖动以设置机位'
  },
  'reshoot.aim.more': {
    en: 'More: lens, height, keep aim',
    'zh-CN': '更多：镜头、高度、保持朝向'
  },
  'reshoot.aim.less': { en: 'Less', 'zh-CN': '收起' },
  'reshoot.aim.reading': {
    en: 'Reading the scene',
    'zh-CN': '正在读取场景'
  },
  'reshoot.axis.rotation': { en: 'Rotation', 'zh-CN': '旋转' },
  'reshoot.axis.tilt': { en: 'Tilt', 'zh-CN': '俯仰' },
  'reshoot.axis.lens': { en: 'Lens', 'zh-CN': '镜头' },
  'reshoot.axis.height': { en: 'Height', 'zh-CN': '高度' },
  'reshoot.view.result': { en: 'Result', 'zh-CN': '结果' },
  'reshoot.view.warp': { en: 'Warp guide', 'zh-CN': '变形引导' },
  'reshoot.view.source': { en: 'Source', 'zh-CN': '原片' },
  'reshoot.views': { en: 'Show', 'zh-CN': '显示' },
  'reshoot.sound': { en: 'Sound', 'zh-CN': '声音' },
  'reshoot.sound.generated': { en: 'Generated', 'zh-CN': '生成的声音' },
  'reshoot.sound.original': { en: 'Original clip', 'zh-CN': '原片声音' },
  'reshoot.warpNote': {
    en: 'The warp guide of a real run shows here: the clip pushed to the new camera, magenta where it has to be invented.',
    'zh-CN':
      '真实运行时这里显示变形引导：片段被推到新机位，洋红色为需要生成的部分。'
  },
  'reshoot.seed': { en: 'Seed', 'zh-CN': '种子' },
  'reshoot.prompt.dialogue': {
    en: 'The model also makes the sound: if your video has dialogue, write the lines here so the new take says them.',
    'zh-CN':
      '模型也会生成声音：如果视频中有对白，请在这里写下台词，新镜头就会说出来。'
  },
  'reshoot.clip.length': {
    en: 'This clip is {seconds} s long. Use one between 5 and 15 seconds.',
    'zh-CN': '该片段长 {seconds} 秒，请使用 5 到 15 秒的片段。'
  },
  'reshoot.reuse': { en: 'Use this angle again', 'zh-CN': '再次使用此机位' },
  'reshoot.clip.change': { en: 'Change', 'zh-CN': '更换' },
  'reshoot.clip.ready': { en: 'Scene read', 'zh-CN': '场景已读取' },
  'reshoot.generate.note': {
    en: 'Takes 1.5 to 5 minutes. Keep aiming while it renders.',
    'zh-CN': '需要 1.5 到 5 分钟，生成期间可以继续调整机位。'
  },
  'reshoot.generate.wait': {
    en: 'Opens once the scene is read, about 20 to 40 seconds.',
    'zh-CN': '场景读取完成后即可使用，约 20 到 40 秒。'
  },
  'reshoot.eyebrow': { en: 'App · Prototype', 'zh-CN': '应用 · 原型' },
  'reshoot.fact.input': {
    en: '5 to 15 s video in',
    'zh-CN': '输入 5 到 15 秒视频'
  },
  'reshoot.fact.size': { en: '480p or 768p', 'zh-CN': '480p 或 768p' },
  'reshoot.fact.time': {
    en: '1.5 to 5 min per take',
    'zh-CN': '每条 1.5 到 5 分钟'
  },
  'reshoot.fact.sound': { en: 'New sound included', 'zh-CN': '包含新声音' },
  'reshoot.expand': { en: 'Full screen', 'zh-CN': '全屏' },
  'reshoot.collapse': { en: 'Exit full screen', 'zh-CN': '退出全屏' },
  'reshoot.pick.exampleTitle': { en: 'Sci-fi pilot', 'zh-CN': '科幻飞行员' },
  'reshoot.section.camera': { en: 'New camera', 'zh-CN': '新机位' },
  'reshoot.section.move': { en: 'Camera move', 'zh-CN': '运镜' },
  'reshoot.section.prompt': {
    en: 'What the new view reveals',
    'zh-CN': '新视角中出现的内容'
  },
  'reshoot.section.format': { en: 'Format', 'zh-CN': '格式' },
  'reshoot.optional': { en: 'Optional', 'zh-CN': '可选' },
  'reshoot.clip.example': { en: 'Example', 'zh-CN': '示例' },
  'reshoot.clip.replace': {
    en: 'Choose another clip',
    'zh-CN': '选择其他片段'
  },
  'reshoot.clip.help': {
    en: 'A 5 to 15 second clip with a clear subject and no letterbox bars.',
    'zh-CN': '5 到 15 秒、主体清晰、没有黑边的片段。'
  },
  'reshoot.aspect': { en: 'Aspect ratio', 'zh-CN': '画面比例' },
  'reshoot.aspect.source': { en: 'Match source', 'zh-CN': '与原片一致' },
  'reshoot.size': { en: 'Output size', 'zh-CN': '输出尺寸' },
  'reshoot.size.480p': { en: 'Faster', 'zh-CN': '更快' },
  'reshoot.size.768p': { en: 'Sharper, slower', 'zh-CN': '更清晰，更慢' },
  'reshoot.axis.azimuth': { en: 'Azimuth', 'zh-CN': '水平角' },
  'reshoot.axis.elevation': { en: 'Elevation', 'zh-CN': '俯仰角' },
  'reshoot.axis.distance': { en: 'Distance', 'zh-CN': '距离' },
  'reshoot.axis.fov': { en: 'Lens FOV', 'zh-CN': '镜头视角' },
  'reshoot.axis.shift': { en: 'Vertical shift', 'zh-CN': '垂直位移' },
  'reshoot.keepAim': {
    en: "Keep the source camera's aim",
    'zh-CN': '保持原机位的朝向'
  },
  'reshoot.zone.green': {
    en: 'Inside the range the model was checked on.',
    'zh-CN': '在模型验证过的范围内。'
  },
  'reshoot.zone.yellow': {
    en: 'Trained, but less reliable.',
    'zh-CN': '训练过，但不太稳定。'
  },
  'reshoot.zone.red': {
    en: 'Outside training. The hidden side will be invented.',
    'zh-CN': '超出训练范围，看不到的一面将由模型想象。'
  },
  'reshoot.dragHint': {
    en: 'Drag to orbit · Scroll to move closer',
    'zh-CN': '拖动以环绕 · 滚动以靠近'
  },
  'reshoot.needsDepth': {
    en: 'Analyze depth to aim a new camera.',
    'zh-CN': '分析深度后即可设置新机位。'
  },
  'reshoot.stale': {
    en: 'Aspect ratio or size changed, so the depth has to be analyzed again.',
    'zh-CN': '画面比例或尺寸已更改，需要重新分析深度。'
  },
  'reshoot.move.static': { en: 'Static', 'zh-CN': '固定机位' },
  'reshoot.move.keys': { en: '{count} keys', 'zh-CN': '{count} 个关键帧' },
  'reshoot.move.help': {
    en: 'Scrub to a frame, aim, press Key. Two or more keys make a move.',
    'zh-CN': '拖到某一帧，调整机位，按“关键帧”。两个以上的关键帧构成运镜。'
  },
  'reshoot.move.frame': { en: 'Frame', 'zh-CN': '帧' },
  'reshoot.move.key': { en: 'Key', 'zh-CN': '关键帧' },
  'reshoot.move.remove': {
    en: 'Remove key at {time}',
    'zh-CN': '删除 {time} 处的关键帧'
  },
  'reshoot.move.clear': { en: 'Clear keys', 'zh-CN': '清除关键帧' },
  'reshoot.move.motion': { en: 'Motion', 'zh-CN': '运动曲线' },
  'reshoot.motion.linear': { en: 'Linear', 'zh-CN': '线性' },
  'reshoot.motion.ease_in': { en: 'Ease in', 'zh-CN': '缓入' },
  'reshoot.motion.ease_out': { en: 'Ease out', 'zh-CN': '缓出' },
  'reshoot.motion.ease_in_out': { en: 'Ease in and out', 'zh-CN': '缓入缓出' },
  'reshoot.motion.smooth': { en: 'Smooth spline', 'zh-CN': '平滑样条' },
  'reshoot.prompt.placeholder': {
    en: 'e.g. a stone wall behind her, more wheat to the left',
    'zh-CN': '例如：她身后是一面石墙，左边有更多麦田'
  },
  'reshoot.analyze': { en: 'Analyze depth', 'zh-CN': '分析深度' },
  'reshoot.analyzing': { en: 'Estimating depth…', 'zh-CN': '正在估算深度…' },
  'reshoot.generate': { en: 'Generate', 'zh-CN': '生成' },
  'reshoot.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'reshoot.generating': {
    en: 'Generating the new view',
    'zh-CN': '正在生成新视角'
  },
  'reshoot.takes': { en: 'Takes', 'zh-CN': '镜头' },
  'reshoot.take.aim': { en: 'Aim', 'zh-CN': '取景' },
  'reshoot.take.example': { en: 'Example result', 'zh-CN': '示例结果' },
  'reshoot.take.static': {
    en: 'Take {n} · az {az}° el {el}°',
    'zh-CN': '第 {n} 条 · 水平 {az}° 俯仰 {el}°'
  },
  'reshoot.take.move': {
    en: 'Take {n} · move, {keys} keys',
    'zh-CN': '第 {n} 条 · 运镜，{keys} 个关键帧'
  },
  'reshoot.take.cancelled': { en: 'Cancelled', 'zh-CN': '已取消' },
  'reshoot.download': { en: 'Download', 'zh-CN': '下载' },
  'reshoot.demoNote': {
    en: 'Design prototype: no jobs run. Takes show the example result.',
    'zh-CN': '设计原型：不会运行任务，镜头显示示例结果。'
  }
} as const satisfies Record<string, LocalizedText>

export type ReshootCopyKey = keyof typeof copy

export function rc(key: ReshootCopyKey, locale: Locale = 'en'): string {
  const entry: LocalizedText = copy[key]
  return entry[locale] ?? entry.en
}
