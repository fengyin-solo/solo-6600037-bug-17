/**
 * 光谱配色集中配置
 *
 * 边界范围、回退色、分段映射与色标示例刻度全部集中在此，
 * 供色标、图样、公式说明共用同一数据源；配套
 * validateSpectrumConfig() 在本地开发（store 初始化）与
 * 构建（vite.config.ts 插件）两个入口校验，缺失映射直接报错。
 *
 * 注意：本模块被 vite.config.ts 引用，必须保持纯 TS，
 * 不得依赖 Vue / import.meta.env / 浏览器 API。
 */

export type RGB = [number, number, number]

/** 可见光边界范围（nm），滑块与映射共用 */
export const SPECTRUM_RANGE = { min: 380, max: 780, step: 5 } as const

/** 无效波段（越界/非数值）时的回退色：可见光之外无颜色，回退为黑 */
export const FALLBACK_RGB: RGB = [0, 0, 0]

/**
 * 波长 → RGB 分段线性映射。
 * 每段 [from, to] 内各通道在端点值间线性插值；
 * 相邻段端点值连续，覆盖范围必须与 SPECTRUM_RANGE 完全咬合。
 * 数值与原有可见光配色逐点一致（380–780nm 经典配色）。
 */
export interface SpectrumSegment {
  from: number
  to: number
  /** [from 处取值, to 处取值]，区间 [0, 1] */
  r: [number, number]
  g: [number, number]
  b: [number, number]
}

export const SPECTRUM_SEGMENTS: SpectrumSegment[] = [
  { from: 380, to: 440, r: [1, 0], g: [0, 0], b: [1, 1] }, // 紫
  { from: 440, to: 490, r: [0, 0], g: [0, 1], b: [1, 1] }, // 蓝→青
  { from: 490, to: 510, r: [0, 0], g: [1, 1], b: [1, 0] }, // 青→绿
  { from: 510, to: 580, r: [0, 1], g: [1, 1], b: [0, 0] }, // 绿→黄
  { from: 580, to: 645, r: [1, 1], g: [1, 0], b: [0, 0] }, // 黄→红
  { from: 645, to: 780, r: [1, 1], g: [0, 0], b: [0, 0] }, // 红
]

/** 色标示例刻度（nm），颜色由 wavelengthToColor 实时计算，保证与图样同源 */
export const SPECTRUM_TICKS: number[] = [380, 500, 550, 600, 780]

export interface SpectrumColor {
  rgb: RGB
  css: string
  /** 是否命中回退色（无效波段） */
  fallback: boolean
}

/**
 * 通道求值。纯色段直接返回端点；单向渐变段按原始配色的
 * 除法形式计算（(nm-from)/span 或 (to-nm)/span），与历史实现
 * 逐位一致，避免 lerp 重新排序运算引入 ±1 的取整偏差。
 */
function evalChannel(pair: [number, number], nm: number, from: number, to: number): number {
  const [a, b] = pair
  if (a === b) return a
  const span = to - from
  if (a === 0 && b === 1) return (nm - from) / span
  if (a === 1 && b === 0) return (to - nm) / span
  return a + (b - a) * ((nm - from) / span)
}

function channelToByte(v: number): number {
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

/** 波长(nm) → RGB。越界或非数值一律返回回退色，绝不残留上一次结果。 */
export function wavelengthToRGB(nm: number): RGB {
  return wavelengthToColor(nm).rgb
}

export function wavelengthToColor(nm: number): SpectrumColor {
  if (!Number.isFinite(nm)) {
    return { rgb: [...FALLBACK_RGB], css: rgbToCss(FALLBACK_RGB), fallback: true }
  }
  const seg = SPECTRUM_SEGMENTS.find(s => nm >= s.from && nm <= s.to)
  if (!seg) {
    return { rgb: [...FALLBACK_RGB], css: rgbToCss(FALLBACK_RGB), fallback: true }
  }
  const rgb: RGB = [
    channelToByte(evalChannel(seg.r, nm, seg.from, seg.to)),
    channelToByte(evalChannel(seg.g, nm, seg.from, seg.to)),
    channelToByte(evalChannel(seg.b, nm, seg.from, seg.to)),
  ]
  return { rgb, css: rgbToCss(rgb), fallback: false }
}

export function rgbToCss(rgb: RGB): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

/**
 * 校验配色配置：分段必须连续、完整覆盖边界范围、通道取值合法、
 * 刻度落在范围内、回退色合法。返回问题列表（空数组 = 通过），
 * 供 dev 运行时与 vite 构建插件共同使用，缺失映射立即暴露。
 */
export function validateSpectrumConfig(): string[] {
  const problems: string[] = []
  const { min, max, step } = SPECTRUM_RANGE

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    problems.push(`SPECTRUM_RANGE 边界非法: [${min}, ${max}]`)
  }
  if (!Number.isFinite(step) || step <= 0) {
    problems.push(`SPECTRUM_RANGE.step 非法: ${step}`)
  }

  if (SPECTRUM_SEGMENTS.length === 0) {
    problems.push('SPECTRUM_SEGMENTS 为空，没有任何波长映射')
  }
  SPECTRUM_SEGMENTS.forEach((seg, i) => {
    if (!(seg.from < seg.to)) {
      problems.push(`分段[${i}] 区间非法: [${seg.from}, ${seg.to}]`)
    }
    for (const ch of ['r', 'g', 'b'] as const) {
      seg[ch].forEach((v, j) => {
        if (!Number.isFinite(v) || v < 0 || v > 1) {
          problems.push(`分段[${i}].${ch}[${j}] 取值越界: ${v}（应在 [0,1]）`)
        }
      })
    }
    if (i > 0 && SPECTRUM_SEGMENTS[i - 1].to !== seg.from) {
      problems.push(
        `分段[${i - 1}] 与分段[${i}] 之间存在缺口或重叠: ` +
        `${SPECTRUM_SEGMENTS[i - 1].to} ≠ ${seg.from}`
      )
    }
  })
  if (SPECTRUM_SEGMENTS.length > 0) {
    const first = SPECTRUM_SEGMENTS[0]
    const last = SPECTRUM_SEGMENTS[SPECTRUM_SEGMENTS.length - 1]
    if (first.from !== min) {
      problems.push(`映射缺少低边界覆盖: 首段起于 ${first.from}，范围起点为 ${min}`)
    }
    if (last.to !== max) {
      problems.push(`映射缺少高边界覆盖: 末段止于 ${last.to}，范围终点为 ${max}`)
    }
  }

  SPECTRUM_TICKS.forEach(t => {
    if (!Number.isFinite(t) || t < min || t > max) {
      problems.push(`色标刻度 ${t} 超出范围 [${min}, ${max}]`)
    }
  })

  FALLBACK_RGB.forEach((v, i) => {
    if (!Number.isInteger(v) || v < 0 || v > 255) {
      problems.push(`FALLBACK_RGB[${i}] 非法: ${v}（应为 0–255 整数）`)
    }
  })

  return problems
}
