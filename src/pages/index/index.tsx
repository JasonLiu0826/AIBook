/*
 * @Author: jason 1917869590@qq.com
 * @Date: 2026-02-21 01:43:30
 * @LastEditors: jason 1917869590@qq.com
 * @LastEditTime: 2026-02-25 19:34:18
 * @FilePath: \AIBook_React_TypeScript\src\pages\index\index.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
    desc: '选择DeepSeek等大模型 / 配置API密钥', 
    type: 'highlight' 
  },
  { 
    url: '/pages/settings/index', 
    title: '后台设定', 
    desc: '笔名 / 人物 / 世界观 / 场景 / 主线 / 更新', 
    type: 'normal' 
  },
  { 
    url: '/pages/config/index', 
    title: '用户配置', 
    desc: '输出字数 / 人称 / 视角 / 震动', 
    type: 'normal' 
  },
  { 
    url: '/pages/story-list/index', 
    title: '开始 / 继续故事', 
    desc: '多本故事管理 / 阅读故事', 
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
        <Text className="title">RealmCrafter</Text>
        <Text className="subtitle">在这里，世界由您定义</Text>
      </View>
      <View className="menu">
        {MENU_CONFIG.map((item, index) => (
          <MenuItemComponent key={index} item={item} />
        ))}
      </View>
    </View>
  )
}
