import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { assertWavelengthConfigValid } from './config/wavelength'
import './style.css'

// 本地开发时立即校验波长映射配置（缺项/衔接错误/示例不匹配会直接抛错）
if (import.meta.env.DEV) {
  assertWavelengthConfigValid()
}

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
