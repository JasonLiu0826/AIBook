import { View, Text, Navigator } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

// 将配置数据抽离，支持后端下发或动态配置
interface MenuItem {
  url: string;
  title: string;
  desc: string;
  type: 'highlight' | 'primary' | 'normal';
  icon?: string;
}

const MENU_CONFIG: MenuItem[] = [
  { 
    url: '/pages/ai-model/index', 
    title: '🤖 AI模型配置', 
    desc: '选择DeepSeek等大模型，配置API密钥', 
    type: 'highlight' 
  },
  { 
    url: '/pages/settings/index', 
    title: '后台设定', 
    desc: '人物 / 世界观 / 场景 / 主线 / 节点（MD）', 
    type: 'normal' 
  },
  { 
    url: '/pages/config/index', 
    title: '用户配置', 
    desc: '输出字数、人称等', 
    type: 'normal' 
  },
  { 
    url: '/pages/story-list/index', 
    title: '开始 / 继续故事', 
    desc: '多本故事管理，阅读章节，选择分支或自定义输入', 
    type: 'primary' 
  },
]

// 单个菜单项组件
const MenuItemComponent = ({ item }: { item: MenuItem }) => {
  return (
    <Navigator 
      url={item.url} 
      className={`item ${item.type}`}
      hoverClass="item-hover" // 增加通用的点击按压态类
    >
      {item.icon && <Text className="item-icon">{item.icon}</Text>}
      <Text className="item-title">{item.title}</Text>
      <Text className="item-desc">{item.desc}</Text>
    </Navigator>
  );
};

export default function Index() {
  return (
    <View className="page-index">
      <View className="header">
        <Text className="title">AI 互动式小说生成器</Text>
        <Text className="subtitle">用设定驱动，让 AI 为你续写故事</Text>
      </View>
      <View className="menu">
        {MENU_CONFIG.map((item, index) => (
          <MenuItemComponent key={index} item={item} />
        ))}
      </View>
    </View>
  )
}
