import { View, Text, Navigator } from '@tarojs/components'
import { useSettings } from '@/store/settings'
import { SETTING_DOCS } from '@/constants/settings'
import './index.scss'

export default function SettingsPage() {
  const { settings, save } = useSettings()

  return (
    <View className="page-settings">
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
