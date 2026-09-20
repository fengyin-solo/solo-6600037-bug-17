<template>
  <div class="min-h-screen bg-slate-900 text-slate-200">
    <header class="border-b border-slate-700 px-6 py-4">
      <h1 class="text-2xl font-bold text-cyan-400">光学干涉衍射仿真实验台</h1>
      <p class="text-sm text-slate-500 mt-1">双缝干涉 · 单缝衍射 · 牛顿环 · 波长调节 · 光强热力图</p>
    </header>
    <div class="flex flex-col lg:flex-row gap-4 p-4">
      <div class="lg:w-1/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">实验类型</h3>
          <div class="space-y-1">
            <button v-for="exp in experiments" :key="exp.id" @click="store.setExperiment(exp.id)"
              :class="['w-full text-left p-2 rounded border text-sm transition-all', store.currentExperiment === exp.id ? 'border-cyan-500 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 text-slate-300 hover:border-slate-500']">
              {{ exp.name }}
            </button>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <h3 class="text-sm font-bold text-slate-400">参数调节</h3>
          <div>
            <label class="text-xs text-slate-500">
              波长 λ = {{ store.params.wavelength }} nm
              <span class="inline-block w-2.5 h-2.5 rounded-full ml-1 align-middle border border-slate-500"
                :style="{ backgroundColor: currentColorCss }"></span>
            </label>
            <input type="range" :min="WAVELENGTH_MIN" :max="WAVELENGTH_MAX" step="5"
              v-model.number="store.params.wavelength" @input="store.compute"
              class="w-full accent-cyan-500" />
            <!-- 色标：渐变条与刻度数字全部来自集中配置，与图样同一份映射 -->
            <div class="w-full h-1.5 rounded mt-1" :style="{ background: spectrumGradientCss }"></div>
            <div class="flex justify-between text-xs mt-0.5">
              <span v-for="tick in SAMPLE_TICKS" :key="tick"
                :style="{ color: rgbCss(wavelengthToRGB(tick)) }">{{ tick }}</span>
            </div>
          </div>
          <div v-if="store.currentExperiment !== 'newton'">
            <label class="text-xs text-slate-500">缝宽/间距 d = {{ store.params.slitWidth }} μm</label>
            <input type="range" min="10" max="200" step="5" v-model.number="store.params.slitWidth" @input="store.compute" class="w-full accent-purple-500" />
          </div>
          <div v-if="store.currentExperiment === 'double'">
            <label class="text-xs text-slate-500">缝间距 D = {{ store.params.slitSeparation }} μm</label>
            <input type="range" min="50" max="500" step="10" v-model.number="store.params.slitSeparation" @input="store.compute" class="w-full accent-green-500" />
          </div>
          <div>
            <label class="text-xs text-slate-500">屏幕距离 L = {{ store.params.screenDistance }} mm</label>
            <input type="range" min="100" max="2000" step="50" v-model.number="store.params.screenDistance" @input="store.compute" class="w-full accent-orange-500" />
          </div>
          <div v-if="store.error" class="text-xs bg-red-900/30 border border-red-700 rounded p-2 text-red-300">
            <div>{{ store.error }}</div>
            <button @click="store.retry" class="mt-1 px-2 py-0.5 rounded bg-red-700/60 hover:bg-red-600 text-white">重试</button>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 text-sm">
          <h3 class="text-sm font-bold text-slate-400 mb-3">理论公式</h3>
          <div class="space-y-2 text-xs text-slate-400">
            <!-- 波长色说明：与色标/图样共用同一参数 store.wavelengthColor -->
            <div class="bg-slate-900 rounded p-2 flex items-center gap-2">
              <span class="inline-block w-4 h-4 rounded border border-slate-500"
                :style="{ backgroundColor: currentColorCss }"></span>
              <span>当前波长 {{ store.params.wavelength }} nm 对应光谱色</span>
            </div>
            <div v-if="store.currentExperiment === 'double'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">双缝干涉</div>
              <div>亮纹: y = kλL/d (k=0,±1,±2...)</div>
              <div>条纹间距: Δy = λL/d</div>
              <div class="text-yellow-400 mt-1">Δy = {{ store.result.fringe?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'single'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">单缝衍射</div>
              <div>暗纹: a·sinθ = kλ</div>
              <div>中央亮纹宽: 2λL/a</div>
              <div class="text-yellow-400 mt-1">中央宽 = {{ store.result.centralWidth?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'newton'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">牛顿环</div>
              <div>暗环半径: r = √(nλR)</div>
              <div>R: 曲率半径</div>
            </div>
          </div>
        </div>
      </div>
      <div class="lg:w-3/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">干涉/衍射图样</h3>
          <canvas ref="patternRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">光强分布曲线</h3>
          <canvas ref="intensityRef" class="w-full rounded" style="height: 200px; background: #0f172a;"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">2D 热力图</h3>
          <canvas ref="heatmapRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useOpticsStore } from './store/optics'
import {
  WAVELENGTH_MIN,
  WAVELENGTH_MAX,
  SAMPLE_TICKS,
  SPECTRUM_GRADIENT_BOUNDS,
  wavelengthToRGB,
  rgbCss,
  rgbaCss,
  type RGB,
} from './config/wavelength'

const store = useOpticsStore()
const patternRef = ref<HTMLCanvasElement | null>(null)
const intensityRef = ref<HTMLCanvasElement | null>(null)
const heatmapRef = ref<HTMLCanvasElement | null>(null)

const experiments = [
  { id: 'double', name: '双缝干涉 (Young实验)' },
  { id: 'single', name: '单缝衍射 (Fraunhofer)' },
  { id: 'newton', name: '牛顿环干涉' },
]

// 所有展示统一使用 store 中的同一颜色参数（连续调节/重试后保持一致）
const currentColor = computed<RGB>(() => store.wavelengthColor)
const currentColorCss = computed(() => rgbCss(currentColor.value))

// 滑块下方的连续光谱渐变：取色边界与 BAND_SEGMENTS 同源，段端点共享颜色故无跳变
const spectrumGradientCss = computed(() => {
  const stops = SPECTRUM_GRADIENT_BOUNDS
    .map((nm) => {
      const pct = ((nm - WAVELENGTH_MIN) / (WAVELENGTH_MAX - WAVELENGTH_MIN)) * 100
      return `${rgbCss(wavelengthToRGB(nm))} ${pct.toFixed(1)}%`
    })
    .join(', ')
  return `linear-gradient(to right, ${stops})`
})

function clearCanvas(canvas: HTMLCanvasElement | null, bg: string) {
  if (!canvas) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawPattern() {
  const canvas = patternRef.value
  if (!canvas) return
  if (store.error || !store.intensityData.length) {
    clearCanvas(canvas, 'black')
    return
  }
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, W, H)
  const color = currentColor.value
  const data = store.intensityData
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = data[idx] || 0
    const alpha = Math.min(1, intensity)
    ctx.fillStyle = rgbaCss(color, alpha)
    ctx.fillRect(x, 0, 1, H)
  }
}

function drawIntensity() {
  const canvas = intensityRef.value
  if (!canvas) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, W, H)

  if (store.error || !store.intensityData.length) return

  const color = currentColor.value
  const data = store.intensityData
  ctx.beginPath()
  ctx.strokeStyle = rgbCss(color)
  ctx.lineWidth = 2
  data.forEach((v, i) => {
    const x = i / (data.length - 1) * W
    const y = H - v * (H - 10) - 5
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  // Fill
  ctx.fillStyle = rgbaCss(color, 0.15)
  ctx.lineTo(W, H); ctx.lineTo(0, H)
  ctx.closePath(); ctx.fill()
  // Axes
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
  ctx.fillText('0', W / 2, H - 2); ctx.fillText('光强 I', 30, 12); ctx.fillText('位置 x', W - 20, H - 2)
}

function drawHeatmap() {
  const canvas = heatmapRef.value
  if (!canvas) return
  if (store.error || !store.intensityData.length) {
    clearCanvas(canvas, 'black')
    return
  }
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const [r, g, b] = currentColor.value
  const data = store.intensityData
  const imgData = ctx.createImageData(W, H)
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = Math.min(1, data[idx] || 0)
    for (let y = 0; y < H; y++) {
      const dist = Math.abs(y - H / 2) / (H / 2)
      const alpha = intensity * (1 - dist * 0.8) * 255
      const pos = (y * W + x) * 4
      imgData.data[pos] = r; imgData.data[pos + 1] = g; imgData.data[pos + 2] = b; imgData.data[pos + 3] = alpha
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

function renderAll() { drawPattern(); drawIntensity(); drawHeatmap() }

onMounted(() => { store.compute(); setTimeout(renderAll, 100) })
watch(() => store.intensityData, () => renderAll(), { deep: true })
// 连续调节时即使数据未变（如边界重复值）也同步刷新图样颜色
watch(() => store.wavelengthColor, () => renderAll())
watch(() => store.error, () => renderAll())
</script>
