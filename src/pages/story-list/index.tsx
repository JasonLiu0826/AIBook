import { useState, useRef } from 'react'
import { View, Text, Button, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStory } from '@/store/story'
import './index.scss'

export default function StoryListPage() {
  // 🌟【防崩溃 1】为所有从 useStory 解构出来的值提供后备保护，防止 Provider 未挂载导致 undefined
  const { 
    storyList = [], 
    createStory, 
    switchStory, 
    deleteStory, 
    renameStory, 
    currentStoryId 
  } = useStory() || {}
  
  // 侧滑相关状态
  const [swipeId, setSwipeId] = useState<string>('')
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  
  // 重命名弹窗状态
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState('')
  const [renameInput, setRenameInput] = useState('')

  const handleCreate = () => {
    if (createStory) {
      createStory()
      Taro.navigateTo({ url: '/pages/story/index' })
    }
  }

  const handleSelect = async (id: string) => {
    if (!id) return
    // 如果在侧滑状态点击卡片本身，先收起侧滑菜单
    if (swipeId === id) {
      setSwipeId('') 
      return
    }
    if (switchStory) {
      await switchStory(id)
      Taro.navigateTo({ url: '/pages/story/index' })
    }
  }

  // 侧滑判定逻辑
  const handleTouchStart = (e: any) => {
    if (!e.touches || !e.touches[0]) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  
  const handleTouchMove = (e: any, id: string) => {
    if (!id || !e.touches || !e.touches[0]) return
    const touchX = e.touches[0].clientX
    const touchY = e.touches[0].clientY
    const deltaX = touchX - touchStartX.current
    const deltaY = Math.abs(touchY - touchStartY.current)
    
    // 如果上下滑动幅度大于左右滑动，说明用户在滚动列表，忽略操作
    if (deltaY > Math.abs(deltaX)) return
    
    if (deltaX < -30) {
      setSwipeId(id)
    } else if (deltaX > 30 && swipeId === id) {
      setSwipeId('')
    }
  }

  const handleDelete = (e: any, id: string) => {
    e.stopPropagation() 
    if (!deleteStory) return
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

  const openRenameModal = (e: any, id: string, oldTitle: string) => {
    e.stopPropagation() 
    setRenameTargetId(id)
    setRenameInput(oldTitle || '')
    setRenameModalVisible(true)
    setSwipeId('') 
  }

  const confirmRename = () => {
    if (!renameInput.trim()) {
      Taro.showToast({ title: '名字不能为空', icon: 'none' })
      return
    }
    if (renameStory) {
      renameStory(renameTargetId, renameInput.trim())
      setRenameModalVisible(false)
      Taro.showToast({ title: '已重命名', icon: 'success' })
    }
  }

  // 🌟【防崩溃 2】对时间戳进行 NaN 防御，防止报错
  const formatDate = (ts?: number) => {
    if (!ts) return '未知时间'
    const d = new Date(ts)
    if (isNaN(d.getTime())) return '未知时间'
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // 🌟【防崩溃 3】强制验证 storyList 必须是一个数组，哪怕缓存穿透了也不会白屏
  const safeStoryList = Array.isArray(storyList) ? storyList : []

  return (
    <View className="page-story-list">
      <View className="header">
        <Text className="title">我的故事</Text>
        <Button className="btn-new" size="mini" onClick={handleCreate}>+ 新建故事</Button>
      </View>

      <ScrollView scrollY className="list">
        {safeStoryList.length === 0 ? (
          <View className="empty">暂无故事，点击右上角新建</View>
        ) : (
          safeStoryList.map((story, index) => {
            // 🌟【防崩溃 4】过滤掉数组中可能存在的 null 或 空对象
            if (!story || !story.id) return null

            return (
              <View 
                key={story.id || index} 
                className={`story-item-wrapper ${currentStoryId === story.id ? 'active' : ''}`}
                onClick={() => handleSelect(story.id)}
              >
                <View 
                  className={`story-item-inner ${swipeId === story.id ? 'swiped' : ''}`}
                  onTouchStart={handleTouchStart}
                  onTouchMove={(e) => handleTouchMove(e, story.id)}
                >
                  <View className="story-content">
                    <View className="story-info">
                      <Text className="story-title">{story.title || '未命名故事'}</Text>
                      <Text className="story-date">{formatDate(story.createdAt)}</Text>
                    </View>
                    {currentStoryId === story.id && <Text className="current-badge">当前</Text>}
                  </View>

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
            )
          })
        )}
      </ScrollView>

      {/* 重命名弹窗 */}
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
