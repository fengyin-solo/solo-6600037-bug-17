#!/usr/bin/env node
/**
 * 构建前检查：波长 -> 颜色映射配置必须完整、连续且与示例数据一致。
 * 通过 TypeScript API 加载 src/config/wavelength.ts（该文件无框架/第三方依赖），
 * 缺项、波段不衔接、示例不匹配或无效波段未回退时以非零码退出，阻断构建。
 *
 * 用法：node scripts/check-wavelength-config.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const configPath = resolve(here, '../src/config/wavelength.ts')
const source = readFileSync(configPath, 'utf8')

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: 'wavelength.ts',
})

const dataUrl = 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')

let mod
try {
  mod = await import(dataUrl)
} catch (e) {
  console.error('✗ 波长配色配置模块加载失败（可能存在缺项或语法错误）：')
  console.error('  ' + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
}

try {
  mod.assertWavelengthConfigValid()
  console.log('✓ 波长配色配置校验通过：边界、波段映射、回退色与示例数据均有效')
} catch (e) {
  console.error('✗ 波长配色配置校验失败：')
  console.error('  ' + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
}
