import { useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStory } from '@/store/story'
import './index.scss'

export default function StoryListPage() {
  const { storyList, currentStoryId, createStory, switchStory, loadStoryList } = useStory()

  useEffect(() => {
    loadStoryList()
  }, [loadStoryList])

  const handleCreate = () => {
    createStory()
    setTimeout(() => Taro.redirectTo({ url: '/pages/story/index' }), 0)
  }

  const handleSelect = (id: string) => {
    switchStory(id).then(() => {
      Taro.redirectTo({ url: '/pages/story/index' })
    })
  }

  return (
    <View className="page-story-list">
      <Button className="btn-new" onClick={handleCreate}>新建故事</Button>
      <View className="list">
        {storyList.length === 0 && (
          <Text className="empty">暂无故事，点击上方「新建故事」开始</Text>
        )}
        {storyList.map((s) => (
          <View
            key={s.id}
            className={`item ${s.id === currentStoryId ? 'active' : ''}`}
            onClick={() => handleSelect(s.id)}
          >
            <Text className="item-title">{s.title}</Text>
            <Text className="item-date">
              {new Date(s.createdAt).toLocaleDateString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
