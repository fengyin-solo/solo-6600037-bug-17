/**
 * 波长 -> 颜色映射的唯一配置来源。
 *
 * 边界范围、回退色、波段映射与示例刻度全部集中在此，
 * 色标滑块、干涉/衍射图样、热力图、曲线与公式说明共用同一份配置，
 * 任何一处都不应再硬编码光谱颜色。
 */

/** RGB 三元组，分量范围 0-255 */
export type RGB = readonly [number, number, number]

/** 可见光波长边界（nm），包含端点 */
export const WAVELENGTH_MIN = 380
export const WAVELENGTH_MAX = 780

/**
 * 越界 / NaN / 未命中任何波段时使用的回退色（中性灰）。
 * 不再返回黑色，避免紫端、红端或无效输入显示成黑色。
 */
export const FALLBACK_COLOR: RGB = [128, 128, 128]

/** 原 wavelengthToRGB 使用的可见光分段名称 */
export type WavelengthBand =
  | 'violet'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'yellow'
  | 'red'

interface BandSegment {
  /** 该波段的起始波长（nm），最后一段延伸到 WAVELENGTH_MAX */
  from: number
  /** 起点颜色 */
  start: RGB
  /** 终点颜色（与下一段 start 必须一致） */
  end: RGB
}

/** 波段在可见光区间内的排列顺序，插值与校验均按此顺序 */
const BAND_ORDER: readonly WavelengthBand[] = ['violet', 'blue', 'cyan', 'green', 'yellow', 'red']

/**
 * 波段映射表：键必须覆盖全部 WavelengthBand，
 * 缺少任何一项时 vue-tsc 类型检查直接报错（构建期发现缺项）。
 *
 * 各端点颜色取自原分段公式在整 10nm 边界处的计算结果，
 * 因此保留原有可见光配色，仅补齐段间插值以消除突变。
 */
export const BAND_SEGMENTS: Record<WavelengthBand, BandSegment> = {
  // 380nm: (255,0,255) -> 440nm: (0,0,255)
  violet: { from: 380, start: [255, 0, 255], end: [0, 0, 255] },
  // 440nm: (0,0,255) -> 490nm: (0,255,255)
  blue:   { from: 440, start: [0, 0, 255], end: [0, 255, 255] },
  // 490nm: (0,255,255) -> 510nm: (0,255,0)
  cyan:   { from: 490, start: [0, 255, 255], end: [0, 255, 0] },
  // 510nm: (0,255,0) -> 580nm: (255,255,0)
  green:  { from: 510, start: [0, 255, 0], end: [255, 255, 0] },
  // 580nm: (255,255,0) -> 645nm: (255,0,0)
  yellow: { from: 580, start: [255, 255, 0], end: [255, 0, 0] },
  // 645nm: (255,0,0) -> 780nm: (255,0,0)
  red:    { from: 645, start: [255, 0, 0], end: [255, 0, 0] },
}

/** 色标与校验共用的示例刻度（nm），原滑块上 380/500/550/600/780 五个标记 */
export const SAMPLE_TICKS: readonly number[] = [380, 500, 550, 600, 780]

/** 绘制连续光谱渐变条时的取色边界（波段起止点），与 BAND_SEGMENTS 同源 */
export const SPECTRUM_GRADIENT_BOUNDS: readonly number[] = [
  WAVELENGTH_MIN,
  ...BAND_ORDER.slice(1)
    .map((band) => BAND_SEGMENTS[band]?.from)
    .filter((v): v is number => typeof v === 'number'),
  WAVELENGTH_MAX,
]

/** 用于构建期/开发期校验的示例数据（nm -> 期望颜色） */
export const SAMPLE_COLORS: ReadonlyArray<readonly [number, RGB]> = [
  [380, [255, 0, 255]],
  [440, [0, 0, 255]],
  [490, [0, 255, 255]],
  [510, [0, 255, 0]],
  [580, [255, 255, 0]],
  [645, [255, 0, 0]],
  [780, [255, 0, 0]],
  // 段内插值抽查（与原分段公式一致）
  [410, [128, 0, 255]],
  [550, [146, 255, 0]],
  [600, [255, 177, 0]],
]

function clamp8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [clamp8(lerp(a[0], b[0], t)), clamp8(lerp(a[1], b[1], t)), clamp8(lerp(a[2], b[2], t))]
}

/**
 * 波长（nm）转 RGB。
 * - 非有限值或超出 [WAVELENGTH_MIN, WAVELENGTH_MAX]：返回 FALLBACK_COLOR
 * - 范围内：按 BAND_SEGMENTS 线性插值，段端点共用颜色，不产生跳变
 */
export function wavelengthToRGB(nm: number): RGB {
  if (!Number.isFinite(nm) || nm < WAVELENGTH_MIN || nm > WAVELENGTH_MAX) {
    return FALLBACK_COLOR
  }

  const segments = BAND_ORDER.map((band) => BAND_SEGMENTS[band])
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const next = segments[i + 1]
    const to = next ? next.from : WAVELENGTH_MAX
    if (nm >= seg.from && (nm < to || (!next && nm <= to))) {
      const span = to - seg.from
      const t = span > 0 ? (nm - seg.from) / span : 0
      return mix(seg.start, seg.end, t)
    }
  }
  return FALLBACK_COLOR
}

/** rgb -> css 字符串 */
export function rgbCss([r, g, b]: RGB): string {
  return `rgb(${r}, ${g}, ${b})`
}

/** rgba -> css 字符串 */
export function rgbaCss([r, g, b]: RGB, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 配置自检：在本地开发与构建检查脚本中运行。
 * 发现波段缺项、顺序/衔接错误、范围错误或示例映射失败时立即抛出，
 * 让缺失映射在开发与构建阶段暴露，而不是残留在界面上。
 */
export function assertWavelengthConfigValid(): void {
  if (!(WAVELENGTH_MIN < WAVELENGTH_MAX)) {
    throw new Error(`波长边界非法: ${WAVELENGTH_MIN} >= ${WAVELENGTH_MAX}`)
  }
  if (!isValidRGB(FALLBACK_COLOR)) {
    throw new Error(`回退色不是合法 RGB: ${String(FALLBACK_COLOR)}`)
  }

  const segments = BAND_ORDER.map((band) => {
    const seg = BAND_SEGMENTS[band]
    if (!seg) throw new Error(`波段映射缺项: ${band}`)
    if (!isValidRGB(seg.start) || !isValidRGB(seg.end)) {
      throw new Error(`波段 ${band} 的颜色不是合法 RGB`)
    }
    return seg
  })

  if (segments[0].from !== WAVELENGTH_MIN) {
    throw new Error(`首个波段起点 ${segments[0].from} 必须等于 ${WAVELENGTH_MIN}`)
  }
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].from <= segments[i - 1].from) {
      throw new Error(`波段顺序错误: ${BAND_ORDER[i]} 的 from 未递增`)
    }
    if (segments[i].from > WAVELENGTH_MAX) {
      throw new Error(`波段 ${BAND_ORDER[i]} 起点超出 ${WAVELENGTH_MAX}`)
    }
    const prevEnd = segments[i - 1].end
    const curStart = segments[i].start
    if (prevEnd.some((v, ch) => v !== curStart[ch])) {
      throw new Error(
        `波段 ${BAND_ORDER[i - 1]} 与 ${BAND_ORDER[i]} 衔接颜色不一致，会产生跳变`,
      )
    }
  }

  for (const tick of SAMPLE_TICKS) {
    if (tick < WAVELENGTH_MIN || tick > WAVELENGTH_MAX) {
      throw new Error(`示例刻度 ${tick} 超出可见光范围`)
    }
    if (!isValidRGB(wavelengthToRGB(tick))) {
      throw new Error(`示例刻度 ${tick} 无法映射到合法颜色`)
    }
  }

  for (const [nm, expected] of SAMPLE_COLORS) {
    const actual = wavelengthToRGB(nm)
    if (actual.some((v, ch) => v !== expected[ch])) {
      throw new Error(
        `示例数据不匹配: ${nm}nm 期望 [${expected.join(',')}]，实际 [${actual.join(',')}]`,
      )
    }
  }

  // 越界 / 无效输入必须稳定落到回退色
  for (const bad of [WAVELENGTH_MIN - 1, WAVELENGTH_MAX + 1, NaN, Infinity, -Infinity]) {
    const c = wavelengthToRGB(bad)
    if (c.some((v, ch) => v !== FALLBACK_COLOR[ch])) {
      throw new Error(`无效波长 ${String(bad)} 未回退到 FALLBACK_COLOR`)
    }
  }
}

function isValidRGB([r, g, b]: RGB): boolean {
  return [r, g, b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
}
