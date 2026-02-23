import { View, Text, Input, Picker, Switch } from '@tarojs/components' // 👈 这里补上了 Switch
import { useUserConfig } from '@/store/userConfig'
import type { NarrativePOV } from '@/types'
import './index.scss'

const POV_OPTIONS: { value: NarrativePOV; label: string }[] = [
  { value: 'first', label: '第一人称（我）' },
  { value: 'second', label: '第二人称（你）' },
  { value: 'third', label: '第三人称（他/她）' }
]

export default function ConfigPage() {
  // 🌟 1. 在顶部的解构中，加入你刚刚写的 setEnableVibration
  const { config, setSingleOutputLength, setPOV, save, setEnableVibration } = useUserConfig()

  const onLengthChange = (e: { detail: { value: string } }) => {
    const n = parseInt(e.detail.value, 10)
    if (!isNaN(n) && n >= 100 && n <= 5000) {
      setSingleOutputLength(n)
      save()
    }
  }

  const onPOVChange = (e: { detail: { value: string | number } }) => {
    const idx = typeof e.detail.value === 'number' ? e.detail.value : parseInt(String(e.detail.value), 10)
    if (!isNaN(idx) && idx >= 0 && idx < POV_OPTIONS.length) {
      setPOV(POV_OPTIONS[idx].value)
      save()
    }
  }

  // 🌟 2. 彻底替换掉原来的 onVibrationChange 函数
  const onVibrationChange = (e: { detail: { value: boolean } }) => {
    // 使用标准的 set 方法更新状态，告别直接赋值
    setEnableVibration(e.detail.value)
    save()
  }

  return (
    <View className="page-config">
      <View className="section">
        <Text className="label">单次输出字数</Text>
        <Input
          className="input"
          type="number"
          placeholder="300–5000"
          value={String(config.singleOutputLength)}
          onBlur={onLengthChange}
          onConfirm={onLengthChange}
        />
        <Text className="hint">建议 500–1500，影响每章长度</Text>
      </View>
      <View className="section">
        <Text className="label">书写人称</Text>
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
        <Text className="hint">第一/二人称代入感更强，第三人称更像传统小说</Text>
      </View>

      {/* 👇 震动反馈开关模块 */}
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