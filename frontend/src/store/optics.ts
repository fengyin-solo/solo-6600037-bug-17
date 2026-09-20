import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  WAVELENGTH_MIN,
  WAVELENGTH_MAX,
  wavelengthToRGB,
  type RGB,
} from '@/config/wavelength'

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref('double')
  const params = ref({ wavelength: 550, slitWidth: 50, slitSeparation: 200, screenDistance: 1000 })
  const intensityData = ref<number[]>([])
  const result = ref<{ fringe?: number; centralWidth?: number }>({})
  const error = ref<string | null>(null)

  /**
   * 当前波长对应的颜色，色标、图样、热力图、曲线、公式说明全部读这一处，
   * 保证连续调节或失败重试后各处指向同一个颜色参数。
   */
  const wavelengthColor = computed<RGB>(() => wavelengthToRGB(params.value.wavelength))

  function isWavelengthValid(nm: number): boolean {
    return Number.isFinite(nm) && nm >= WAVELENGTH_MIN && nm <= WAVELENGTH_MAX
  }

  function setExperiment(id: string) {
    currentExperiment.value = id
    compute()
  }

  function compute() {
    if (!isWavelengthValid(params.value.wavelength)) {
      // 无效波段：进入错误态，不沿用上一次的数据/颜色
      error.value = `波长 ${params.value.wavelength} nm 不在可见光范围 ${WAVELENGTH_MIN}–${WAVELENGTH_MAX} nm 内`
      intensityData.value = []
      result.value = {}
      return
    }

    try {
      runCompute()
      error.value = null
    } catch (e) {
      // 计算失败时保留错误态等待重试，避免渲染旧结果造成“残留上一颜色”
      error.value = e instanceof Error ? e.message : '图样计算失败'
    }
  }

  /** 失败后重试：清掉错误态并按当前参数重新计算 */
  function retry() {
    error.value = null
    compute()
  }

  function runCompute() {
    const { wavelength: lam, slitWidth: a, slitSeparation: d, screenDistance: L } = params.value
    const lambda = lam * 1e-9
    const aM = a * 1e-6
    const dM = d * 1e-6
    const LM = L * 1e-3
    const N = 800
    const data: number[] = []
    const xMax = 20e-3

    if (currentExperiment.value === 'double') {
      result.value.fringe = Math.round(lambda * LM / dM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const delta = Math.PI * dM * x / (lambda * LM)
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const single = Math.sin(beta) / beta
        const intensity = Math.cos(delta) ** 2 * single ** 2
        data.push(Math.max(0, intensity))
      }
    } else if (currentExperiment.value === 'single') {
      result.value.centralWidth = Math.round(2 * lambda * LM / aM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const intensity = (Math.sin(beta) / beta) ** 2
        data.push(Math.max(0, intensity))
      }
    } else { // newton
      const R = 1.0
      for (let i = 0; i < N; i++) {
        const r = (i / N) * 5e-3
        const path = r * r / (2 * R)
        const phi = 2 * Math.PI * path / lambda + Math.PI
        const intensity = 0.5 * (1 - Math.cos(phi))
        data.push(Math.max(0, intensity))
      }
    }

    intensityData.value = data
  }

  return {
    currentExperiment,
    params,
    intensityData,
    result,
    error,
    wavelengthColor,
    setExperiment,
    compute,
    retry,
  }
})
