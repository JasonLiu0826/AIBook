import { View, Text, Navigator } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Index() {
  return (
    <View className="page-index">
      <View className="header">
        <Text className="title">AI 互动式小说生成器</Text>
        <Text className="subtitle">用设定驱动，让 AI 为你续写故事</Text>
      </View>
      <View className="menu">
        <Navigator url="/pages/ai-model/index" className="item highlight">
          <Text className="item-title">🤖 AI模型配置</Text>
          <Text className="item-desc">选择DeepSeek等大模型，配置API密钥</Text>
        </Navigator>
        <Navigator url="/pages/settings/index" className="item">
          <Text className="item-title">后台设定</Text>
          <Text className="item-desc">人物 / 世界观 / 场景 / 主线 / 节点（MD）</Text>
        </Navigator>
        <Navigator url="/pages/config/index" className="item">
          <Text className="item-title">用户配置</Text>
          <Text className="item-desc">输出字数、人称等</Text>
        </Navigator>
        <Navigator url="/pages/story-list/index" className="item primary">
          <Text className="item-title">开始 / 继续故事</Text>
          <Text className="item-desc">多本故事管理，阅读章节，选择分支或自定义输入</Text>
        </Navigator>
      </View>
    </View>
  )
}
