import Taro from '@tarojs/taro'
import { View, Text, Input, Picker, Textarea, Button } from '@tarojs/components'
import { useUserConfig } from '@/store/userConfig'
import { useSettings } from '@/store/settings'
import { polishSetting } from '@/services/ai'
import type { NarrativePOV } from '@/types'
import './index.scss'

const POV_OPTIONS: { value: NarrativePOV; label: string }[] = [
  { value: 'first', label: '第一人称（我）' },
  { value: 'second', label: '第二人称（你）' },
  { value: 'third', label: '第三人称（他/她）' }
]

export default function ConfigPage() {
  const { config, setSingleOutputLength, setPOV, save } = useUserConfig()
  const { settings, setOne, save: saveSettings } = useSettings()

  // ✅ AI润色处理函数
  const handlePolish = async (type: 'worldview' | 'character') => {
    const text = type === 'worldview' ? settings.worldview : settings.characters;
    if (!text.trim()) {
      Taro.showToast({ title: '请先输入内容', icon: 'none' });
      return;
    }
    if (!config.apiKey?.trim()) {
      Taro.showToast({ title: '请先配置API Key', icon: 'none' });
      return;
    }
    
    Taro.showLoading({ title: 'AI润色中...' });
    try {
      // 调用润色服务时转换类型
      const polishedText = await polishSetting(text, type as any, config.apiKey);
      setOne(type === 'worldview' ? 'worldview' : 'characters', polishedText);
      await saveSettings();
      Taro.hideLoading();
      Taro.showToast({ title: '润色完成', icon: 'success' });
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error.message || '润色失败', icon: 'none' });
    }
  };

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
      {/* 原有的配置项 */}
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

      {/* ✅ 新增：世界观设定与AI润色 */}
      <View className="setting-item">
        <View className="header">
          <Text>世界观设定</Text>
          <Button size='mini' onClick={() => handlePolish('worldview')}>✨ AI润色</Button>
        </View>
        <Textarea 
          className="textarea"
          value={settings.worldview} 
          placeholder="请输入世界观设定..."
          onInput={(e) => setOne('worldview', e.detail.value)} 
        />
      </View>

      {/* ✅ 新增：人物设定与AI润色 */}
      <View className="setting-item">
        <View className="header">
          <Text>人物设定</Text>
          <Button size='mini' onClick={() => handlePolish('character')}>✨ AI润色</Button>
        </View>
        <Textarea 
          className="textarea"
          value={settings.characters} 
          placeholder="请输入人物设定..."
          onInput={(e) => setOne('characters', e.detail.value)} 
        />
      </View>

      {/* ✅ 新增：重要故事节点显示区 */}
      <View className="setting-item">
        <Text>重要故事节点（AI 自动维护，可手动修改）</Text>
        <Textarea 
          className="node-area"
          value={settings.storyNodes} 
          placeholder="第一次由您输入，之后AI将自动记录关键情节..."
          onInput={(e) => setOne('storyNodes', e.detail.value)} 
        />
      </View>
    </View>
  )
}
