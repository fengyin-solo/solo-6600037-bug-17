import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SPECTRUM_RANGE, validateSpectrumConfig, wavelengthToColor } from '@/config/spectrum'

// 本地开发时立即暴露缺失/断裂的波长映射（构建期另有 vite 插件校验）
if (import.meta.env.DEV) {
  const problems = validateSpectrumConfig()
  if (problems.length) {
    throw new Error(`波长配色配置缺失映射:\n${problems.join('\n')}`)
  }
}

/** 非有限数值一律归零，避免 NaN 流入渲染导致 canvas 颜色残留 */
function finiteOrZero(v: number): number {
  return Number.isFinite(v) ? v : 0
}

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref('double')
  const params = ref({ wavelength: 550, slitWidth: 50, slitSeparation: 200, screenDistance: 1000 })
  const intensityData = ref<number[]>([])
  const result = ref<{ fringe?: number; centralWidth?: number }>({})

  // 色标、图样、公式说明共用的唯一颜色来源，始终指向当前波长参数
  const wavelengthColor = computed(() => wavelengthToColor(params.value.wavelength))

  function setExperiment(id: string) { currentExperiment.value = id; compute() }

  function compute() {
    const { wavelength: lam, slitWidth: a, slitSeparation: d, screenDistance: L } = params.value
    const N = 800
    const data: number[] = []
    const xMax = 20e-3

    // 无效波段（非数值/越界/非正）：清空结果与数据，渲染层使用回退色，
    // 不残留上一次成功的图样
    const valid =
      Number.isFinite(lam) && lam >= SPECTRUM_RANGE.min && lam <= SPECTRUM_RANGE.max &&
      Number.isFinite(a) && a > 0 &&
      Number.isFinite(d) && d > 0 &&
      Number.isFinite(L) && L > 0
    if (!valid) {
      result.value = {}
      intensityData.value = []
      return
    }

    const lambda = lam * 1e-9
    const aM = a * 1e-6
    const dM = d * 1e-6
    const LM = L * 1e-3

    if (currentExperiment.value === 'double') {
      result.value.fringe = Math.round(lambda * LM / dM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const delta = Math.PI * dM * x / (lambda * LM)
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const single = Math.sin(beta) / beta
        const intensity = Math.cos(delta) ** 2 * single ** 2
        data.push(Math.max(0, finiteOrZero(intensity)))
      }
    } else if (currentExperiment.value === 'single') {
      result.value.centralWidth = Math.round(2 * lambda * LM / aM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const intensity = (Math.sin(beta) / beta) ** 2
        data.push(Math.max(0, finiteOrZero(intensity)))
      }
    } else { // newton
      const R = 1.0
      for (let i = 0; i < N; i++) {
        const r = (i / N) * 5e-3
        const path = r * r / (2 * R)
        const phi = 2 * Math.PI * path / lambda + Math.PI
        const intensity = 0.5 * (1 - Math.cos(phi))
        data.push(Math.max(0, finiteOrZero(intensity)))
      }
    }

    intensityData.value = data
  }

  return { currentExperiment, params, intensityData, result, wavelengthColor, setExperiment, compute }
})
