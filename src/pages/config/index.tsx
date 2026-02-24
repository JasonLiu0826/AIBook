/*
 * @Author: jason 1917869590@qq.com
 * @Date: 2026-02-24 01:43:54
 * @LastEditors: jason 1917869590@qq.com
 * @LastEditTime: 2026-02-24 15:05:12
 * @FilePath: \AIBook_React_TypeScript\src\pages\config\index.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { View, Text, Input, Picker, Switch } from '@tarojs/components'
import { useUserConfig } from '@/store/userConfig'
import { useState, useEffect } from 'react' // 👈 必须引入 useState 和 useEffect
import type { NarrativePOV, NarrativePerspective } from '@/types'
import './index.scss'

const POV_OPTIONS: { value: NarrativePOV; label: string }[] = [
  { value: 'first', label: '第一人称（我）' },
  { value: 'second', label: '第二人称（你）' },
  { value: 'third', label: '第三人称（他/她）' },
  { value: 'third_it', label: '第三人称（它）' }
]

// 🌟 新增视角的下拉选项
const PERSPECTIVE_OPTIONS = [
  { value: 'omniscient', label: '上帝视角（全知全能/群像）' },
  { value: 'specific', label: '特定角色视角（限知沉浸）' }
]

export default function ConfigPage() {
  const { config, setSingleOutputLength, setPOV, setPerspective, setSpecificCharacterName, save, setEnableVibration } = useUserConfig()

  // 🌟 1. 核心优化：使用本地临时状态接管输入框，摆脱全局强制刷新导致的"改不了"卡死现象
  const [lengthStr, setLengthStr] = useState(String(config.singleOutputLength || 800))

  // 🌟 2. 监听全局变化，初始化或重新加载时同步状态
  useEffect(() => {
    setLengthStr(String(config.singleOutputLength || 800))
  }, [config.singleOutputLength])

  // 🌟 3. 实时响应键盘输入（不做阻拦，允许用户先打出 1、12、空白 等非最终状态）
  const onInput = (e: { detail: { value: string } }) => {
    setLengthStr(e.detail.value)
  }

  // 🌟 4. 失去焦点或点击确认时，执行最终的合法性校验
  const onBlur = () => {
    let n = parseInt(lengthStr, 10)
    
    // 校验：不是数字退回 800；强制修正到 100 - 1500 的范围区间
    if (isNaN(n)) n = 800
    if (n < 100) n = 100
    if (n > 1500) n = 1500
    
    setLengthStr(String(n)) // 修正界面展示（如果输入了 99，这里会变成 100）
    setSingleOutputLength(n) // 同步给底层全局配置
    save() // 自动保存到本地缓存
  }

  const onPOVChange = (e: { detail: { value: string | number } }) => {
    const idx = typeof e.detail.value === 'number' ? e.detail.value : parseInt(String(e.detail.value), 10)
    if (!isNaN(idx) && idx >= 0 && idx < POV_OPTIONS.length) {
      setPOV(POV_OPTIONS[idx].value)
      save()
    }
  }

  const onPerspectiveChange = (e: { detail: { value: string | number } }) => {
    const idx = typeof e.detail.value === 'number' ? e.detail.value : parseInt(String(e.detail.value), 10)
    if (!isNaN(idx) && idx >= 0 && idx < PERSPECTIVE_OPTIONS.length) {
      setPerspective(PERSPECTIVE_OPTIONS[idx].value as NarrativePerspective)
      save()
    }
  }

  const onVibrationChange = (e: { detail: { value: boolean } }) => {
    setEnableVibration(e.detail.value)
    save()
  }

  return (
    <View className="page-config">
      <View className="section">
        <Text className="label">单次输出字数</Text>
        {/* 👈 输入框核心优化：使用本地状态避免全局刷新卡死 */}
        <Input
          className="input"
          type="number"
          placeholder="100–1500"
          value={lengthStr}
          onInput={onInput}
          onBlur={onBlur}
          onConfirm={onBlur}
        />
        {/* 👇 提示文案按照你的需求进行了明确优化 */}
        <Text className="hint">建议 500–1000。输入后，AI 生成文章的篇幅大小将根据此设定决定；默认 800。字数还会影响Token消耗，请根据需要进行调整</Text>
      </View>
      {/* 模块1：书写人称 */}
      <View className="section">
        <Text className="label">语法人称</Text>
        <Picker
          mode="selector"
          range={POV_OPTIONS.map((o) => o.label)}
          value={POV_OPTIONS.findIndex((o) => o.value === config.pov)}
          onChange={onPOVChange}
        >
          <View className="picker">
            <Text>{POV_OPTIONS.find((o) => o.value === config.pov)?.label ?? config.pov}</Text>
          </View>
        </Picker>
        <Text className="hint">决定文章中指代主角的词汇（我/你/他）。</Text>
      </View>

      {/* 🌟 模块2：新增的叙事视角 */}
      <View className="section">
        <Text className="label">叙事视角与镜头</Text>
        <Picker
          mode="selector"
          range={PERSPECTIVE_OPTIONS.map((o) => o.label)}
          value={PERSPECTIVE_OPTIONS.findIndex((o) => o.value === config.perspective)}
          onChange={onPerspectiveChange}
        >
          <View className="picker">
            <Text>{PERSPECTIVE_OPTIONS.find((o) => o.value === config.perspective)?.label ?? '上帝视角'}</Text>
          </View>
        </Picker>
        
        {/* 当选择"特定角色"时展开输入框 */}
        {config.perspective === 'specific' && (
          <View style={{ marginTop: '12px' }}>
            <Input
              className="input"
              placeholder="请输入被锁定的角色名 (如: 林默)"
              value={config.specificCharacterName || ''}
              onInput={(e) => setSpecificCharacterName(e.detail.value)}
              onBlur={save}
              onConfirm={save}
            />
          </View>
        )}
        <Text className="hint">
          {config.perspective === 'omniscient' 
            ? '镜头灵活多变，AI 可以写出多线人物的心理和群像剧本。' 
            : '深度沉浸！AI 将严格锁定在此人身上，不知道其余角色的想法。'}
        </Text>
      </View>

      <View className="section">
        <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Text className="label" style={{ marginBottom: 0 }}>📳 触觉震动反馈</Text>
          <Switch 
            checked={config.enableVibration !== false} 
            color="#4a7c59"
            onChange={onVibrationChange} 
          />
        </View>
        <Text className="hint" style={{ marginTop: '16rpx', display: 'block' }}>开启后，点击按钮和AI打字时会有细腻的物理震动体验</Text>
      </View>
    </View>
  )
}