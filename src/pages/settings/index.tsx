import { useState, useEffect } from 'react'
import { View, Text, Navigator, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { SETTING_DOCS } from '@/constants/settings'
import './index.scss'

export default function SettingsPage() {
  const { settings, save } = useSettings()
  const [authorName, setAuthorName] = useState('')

  useEffect(() => {
    // 从本地存储获取笔名
    const storedName = Taro.getStorageSync('aibook_author_name') || '匿名创作者'
    setAuthorName(storedName)
  }, [])

  const handleAuthorNameChange = (value: string) => {
    setAuthorName(value)
    Taro.setStorageSync('aibook_author_name', value)
  }

  return (
    <View className="page-settings">
      {/* 笔名设置区域 */}
      <View className="section">
        <Text className="section-title">创作者信息</Text>
        <View className="input-group">
          <Text className="input-label">笔名/署名</Text>
          <Input
            className="input-field"
            placeholder="请输入你的专属笔名或昵称"
            value={authorName}
            onInput={(e) => handleAuthorNameChange(e.detail.value)}
          />
          <Text className="input-desc">用于生成分享卡片时的创作者署名</Text>
        </View>
      </View>
      
      <View className="tip">
        <Text>以下 MD 文档将作为 AI 生成的实时参考依据，可粘贴或手动编辑。</Text>
      </View>
      <View className="list">
        {SETTING_DOCS.map((doc) => (
          <Navigator
            key={doc.key}
            url={`/pages/editor/index?key=${doc.key}&title=${encodeURIComponent(doc.title)}`}
            className="card"
          >
            <Text className="card-title">{doc.title}</Text>
            <Text className="card-preview">
              {settings[doc.key] ? `${settings[doc.key].slice(0, 60)}${settings[doc.key].length > 60 ? '…' : ''}` : '未填写'}
            </Text>
          </Navigator>
        ))}
      </View>
      <View className="actions">
        <Text className="save-hint">编辑后自动保存到本地</Text>
      </View>
    </View>
  )
}
