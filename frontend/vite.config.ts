import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { validateSpectrumConfig } from './src/config/spectrum'

/**
 * 波长配色配置校验：dev 启动与 build 都会在 buildStart 触发，
 * 缺失映射（分段缺口/边界未覆盖/刻度越界等）直接报错中断。
 */
function spectrumConfigCheck(): Plugin {
  return {
    name: 'spectrum-config-check',
    buildStart() {
      const problems = validateSpectrumConfig()
      if (problems.length) {
        this.error(`波长配色配置缺失映射:\n${problems.join('\n')}`)
      }
    }
  }
}

export default defineConfig({
  plugins: [vue(), spectrumConfigCheck()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    open: false,
    port: 5173
  }
})
