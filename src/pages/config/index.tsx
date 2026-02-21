import { View, Text, Input, Picker } from '@tarojs/components'
import { useUserConfig } from '@/store/userConfig'
import type { NarrativePOV } from '@/types'
import './index.scss'

const POV_OPTIONS: { value: NarrativePOV; label: string }[] = [
  { value: 'first', label: '第一人称（我）' },
  { value: 'second', label: '第二人称（你）' },
  { value: 'third', label: '第三人称（他/她）' }
]

export default function ConfigPage() {
  const { config, setSingleOutputLength, setPOV, save } = useUserConfig()

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
    </View>
  )
}
