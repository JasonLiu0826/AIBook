import { useState, useRef } from 'react'
import { View, Text, Button, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStory } from '@/store/story'
import './index.scss'

export default function StoryListPage() {
  const { storyList, createStory, switchStory, deleteStory, renameStory, currentStoryId } = useStory()
  
  // 侧滑相关状态
  const [swipeId, setSwipeId] = useState<string>('')
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  
  // 重命名弹窗状态
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState('')
  const [renameInput, setRenameInput] = useState('')

  const handleCreate = () => {
    const newId = createStory()
    Taro.navigateTo({ url: '/pages/story/index' })
  }

  const handleSelect = async (id: string) => {
    // 如果在侧滑状态点击卡片本身，先收起侧滑菜单，而不是跳转
    if (swipeId === id) {
      setSwipeId('') 
      return
    }
    await switchStory(id)
    Taro.navigateTo({ url: '/pages/story/index' })
  }

  // 👇 侧滑判定逻辑
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  
  const handleTouchMove = (e: any, id: string) => {
    const touchX = e.touches[0].clientX
    const touchY = e.touches[0].clientY
    const deltaX = touchX - touchStartX.current
    const deltaY = Math.abs(touchY - touchStartY.current)
    
    // 如果上下滑动幅度大于左右滑动，说明用户在滚动列表，忽略操作
    if (deltaY > Math.abs(deltaX)) return
    
    if (deltaX < -30) {
      // 向左滑动：展开操作菜单
      setSwipeId(id)
    } else if (deltaX > 30 && swipeId === id) {
      // 向右滑动：收起操作菜单
      setSwipeId('')
    }
  }

  // 执行删除
  const handleDelete = (e: any, id: string) => {
    e.stopPropagation() // 阻止冒泡跳转
    Taro.showModal({
      title: '删除确认',
      content: '确定要删除这个故事吗？此操作不可恢复。',
      confirmColor: '#d9534f',
      success: (res) => {
        if (res.confirm) {
          deleteStory(id)
          setSwipeId('')
        }
      }
    })
  }

  // 开启重命名弹窗
  const openRenameModal = (e: any, id: string, oldTitle: string) => {
    e.stopPropagation() // 阻止冒泡
    setRenameTargetId(id)
    setRenameInput(oldTitle)
    setRenameModalVisible(true)
    setSwipeId('') // 点击重命名后顺便把侧滑菜单收回去
  }

  // 确认重命名
  const confirmRename = () => {
    if (!renameInput.trim()) {
      Taro.showToast({ title: '名字不能为空', icon: 'none' })
      return
    }
    renameStory(renameTargetId, renameInput.trim())
    setRenameModalVisible(false)
    Taro.showToast({ title: '已重命名', icon: 'success' })
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <View className="page-story-list">
      <View className="header">
        <Text className="title">我的故事</Text>
        <Button className="btn-new" size="mini" onClick={handleCreate}>+ 新建故事</Button>
      </View>

      <ScrollView scrollY className="list">
        {storyList.length === 0 ? (
          <View className="empty">暂无故事，点击右上角新建</View>
        ) : (
          storyList.map(story => (
            <View 
              key={story.id} 
              className={`story-item-wrapper ${currentStoryId === story.id ? 'active' : ''}`}
              onClick={() => handleSelect(story.id)}
            >
              {/* 这个 Inner 层是随着手指滑动的 */}
              <View 
                className={`story-item-inner ${swipeId === story.id ? 'swiped' : ''}`}
                onTouchStart={handleTouchStart}
                onTouchMove={(e) => handleTouchMove(e, story.id)}
              >
                <View className="story-content">
                  <View className="story-info">
                    <Text className="story-title">{story.title}</Text>
                    <Text className="story-date">{formatDate(story.createdAt)}</Text>
                  </View>
                  {currentStoryId === story.id && <Text className="current-badge">当前</Text>}
                </View>

                {/* 隐藏在右侧外的操作按钮（总宽 140px） */}
                <View className="story-actions">
                  <View className="action-btn rename" onClick={(e) => openRenameModal(e, story.id, story.title)}>
                    重命名
                  </View>
                  <View className="action-btn delete" onClick={(e) => handleDelete(e, story.id)}>
                    删除
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 自研重命名弹窗遮罩 */}
      {renameModalVisible && (
        <View className="modal-overlay" onClick={() => setRenameModalVisible(false)}>
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <View className="modal-title">重命名故事</View>
            <Input 
              className="modal-input" 
              value={renameInput} 
              onInput={e => setRenameInput(e.detail.value)}
              focus
            />
            <View className="modal-btns">
              <Button className="btn cancel" onClick={() => setRenameModalVisible(false)}>取消</Button>
              <Button className="btn confirm" onClick={confirmRename}>确认</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
