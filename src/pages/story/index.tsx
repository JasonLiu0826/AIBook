import { useState, useMemo, useEffect } from 'react'
import { View, Text, Button, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { useUserConfig } from '@/store/userConfig'
import { useStory } from '@/store/story'
import { generateChapterStream, isGenerateApiConfigured, getMockFirstChapter } from '@/services/ai'
import type { Chapter, BranchOption } from '@/types'
import './index.scss'

function genId() {
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function exportChaptersToText(chapters: Chapter[]): string {
  const timestamp = new Date().toLocaleString('zh-CN')
  const header = `📖 AI互动小说导出

导出时间: ${timestamp}
总章节数: ${chapters.length}章

${'='.repeat(50)}

`
  
  const content = chapters
    .map((ch, index) => {
      const divider = index === 0 ? '' : `\n${'─'.repeat(30)}\n\n`
      return `${divider}第 ${ch.index} 章 ${ch.title}\n\n${ch.content}`
    })
    .join('\n')
  
  const footer = `

${'='.repeat(50)}

📝 本故事由AIBook智能创作助手生成`  
  return header + content + footer
}

export default function StoryPage() {
  const { settings, save: saveSettings } = useSettings()
  const { config } = useUserConfig()
  const {
    chapters,
    currentStoryId,
    addChapter,
    generating,
    setGenerating,
    resetStory,
    loadStoryList
  } = useStory()
  const [customBranch, setCustomBranch] = useState('')
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  
  // 🌟【修复点1】增加一个专门用于展示打字机过程的临时状态
  const [typingChapter, setTypingChapter] = useState<Partial<Chapter> | null>(null)

  const apiConfigured = isGenerateApiConfigured(config.aiProvider, config.apiKey)
  const lastChapter = useMemo(() => chapters[chapters.length - 1], [chapters])
  const contextSummary = useMemo(() => {
    if (chapters.length === 0) return undefined
    const lastFew = chapters
      .slice(-3)
      .map((c) => `【${c.title}】${c.content.slice(0, 200)}…`)
      .join('\n')
    return lastFew
  }, [chapters])
  
  // 计算总字数
  const totalWordCount = useMemo(() => {
    return chapters.reduce((total, chapter) => total + chapter.content.length, 0)
  }, [chapters])
  
  // 获取当前分支建议
  const branchSuggestions = useMemo(() => {
    if (lastChapter?.branches?.length) {
      return lastChapter.branches.slice(0, 2).map(b => b.text)
    }
    return [
      '主角面临重大抉择',
      '意外事件改变局势',
      '新的角色登场',
      '隐藏的秘密被揭露'
    ]
  }, [lastChapter])

  useEffect(() => {
    loadStoryList()
  }, [loadStoryList])

  const doGenerate = async (chosenBranch?: string) => {
    setError('')
    setShowSuccess(false)
    setGenerating(true)
    let loadingShown = false
    let errorToast: { title: string; icon: 'none' | 'success', duration: number } | null = null
    
    try {
      Taro.showLoading({ title: '正在构思剧情...', mask: true })
      loadingShown = true
      
      if (!settings.characters || settings.characters.trim().length === 0) {
        throw new Error('请先在后台设定中完善人物设定')
      }
      
      await saveSettings()
      
      // 🌟【修复点2】初始化打字机状态
      setTypingChapter({ index: chapters.length + 1, title: '', content: '' })
      
      let partialTitle = '';
      let partialContent = '';
      let partialBranches: string[] = [];
      
      const result = await generateChapterStream(
        {
          settings,
          userConfig: config,
          contextSummary,
          chosenBranch,
          nextChapterIndex: chapters.length + 1
        },
        (partialData) => {
          // 🌟【修复点3】当收到任何真实内容时，立刻关掉挡路的 Loading，让用户欣赏打字过程！
          if (loadingShown && (partialData.type === 'title' || partialData.type === 'content')) {
            Taro.hideLoading()
            loadingShown = false
          }

          switch (partialData.type) {
            case 'title':
              partialTitle = partialData.value;
              setTypingChapter(prev => prev ? { ...prev, title: partialTitle } : null)
              break;
            case 'content':
              partialContent += partialData.value;
              setTypingChapter(prev => prev ? { ...prev, content: partialContent } : null)
              
              // 自动滚动到底部
              setTimeout(() => {
                if (typeof document !== 'undefined') {
                  const scrollView = document.querySelector('.scroll')
                  if (scrollView) scrollView.scrollTop = scrollView.scrollHeight
                }
              }, 50)
              break;
            case 'branches':
              try {
                partialBranches = JSON.parse(partialData.value);
              } catch (e) {}
              break;
          }
        }
      )
      
      // 生成结束，清空临时打字机状态，并把完整章节加入主仓库
      setTypingChapter(null)
      
      if (!result.title || !result.content) {
        throw new Error('AI返回的内容格式异常，请重试')
      }
      
      const chapter: Chapter = {
        id: genId(),
        index: chapters.length + 1,
        title: result.title,
        content: result.content,
        branches: result.branches.map((text, i) => ({ id: `b_${i}`, text, isCustom: false })) as BranchOption[],
        createdAt: Date.now()
      }
      
      addChapter(chapter)
      setShowSuccess(true)
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败，请稍后重试'
      setError(msg)
      setTypingChapter(null) // 出错也要清空状态
      
      errorToast = { title: msg.includes('网络') ? '网络连接失败' : msg, icon: 'none', duration: 3000 }
    } finally {
      setGenerating(false)
      if (loadingShown) Taro.hideLoading()
      if (errorToast) Taro.showToast(errorToast)
    }
  }

  const onStart = () => doGenerate()
  
  const onSelectBranch = (text: string) => {
    setCustomBranch('')
    setShowSuccess(false)
    doGenerate(text)
  }
  
  const onCustomBranch = () => {
    const t = customBranch.trim()
    if (!t) {
      Taro.showToast({ 
        title: '请输入您想要的剧情走向', 
        icon: 'none' 
      })
      return
    }
    if (t.length < 5) {
      Taro.showToast({ 
        title: '描述太短啦，至少5个字哦', 
        icon: 'none' 
      })
      return
    }
    onSelectBranch(t)
  }

  const handleExport = async () => {
    if (chapters.length === 0) {
      Taro.showToast({ title: '暂无内容可导出', icon: 'none' })
      return
    }
    
    let loadingShown = false
    try {
      Taro.showLoading({ title: '正在导出...' })
      loadingShown = true
      const text = exportChaptersToText(chapters)
      
      await Taro.setClipboardData({
        data: text
      })
      
      Taro.showToast({ 
        title: `已导出${chapters.length}章内容到剪贴板`, 
        icon: 'success',
        duration: 2500
      })
    } catch (error) {
      console.error('导出失败:', error)
      Taro.showToast({ 
        title: '导出失败，请重试', 
        icon: 'none' 
      })
    } finally {
      // 确保只在显示了loading的情况下才隐藏
      if (loadingShown) {
        Taro.hideLoading()
      }
    }
  }

  if (!currentStoryId) {
    return (
      <View className="page-story no-current">
        <View className="empty">
          <Text className="empty-icon">📚</Text>
          <Text className="empty-title">请选择或新建故事</Text>
          <Text className="empty-desc">在故事列表中新建一本精彩的互动小说，或选择已有故事继续您的冒险之旅</Text>
          <Button 
            className="btn-start" 
            onClick={() => Taro.navigateTo({ url: '/pages/story-list/index' })}
          >
            浏览故事列表
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="page-story">
      <ScrollView scrollY className="scroll" scrollWithAnimation>
        {/* API 配置提示 */}
        {!apiConfigured && chapters.length === 0 && (
          <View className="api-tip">
            <Text>💡 温馨提示：您尚未配置AI生成接口，系统将为您展示精彩的故事示例。配置后端接口后即可享受完整的AI创作体验！</Text>
          </View>
        )}
        
        {/* 空状态 */}
        {chapters.length === 0 && (
          <View className="empty">
            <Text className="empty-icon">✨</Text>
            <Text className="empty-title">开启您的创作之旅</Text>
            <Text className="empty-desc">基于您精心设定的世界观和人物，AI将为您编织独一无二的互动故事。点击下方按钮开始创作吧！</Text>
            <Button 
              className="btn-start" 
              disabled={generating} 
              onClick={onStart}
            >
              {generating ? (
                <>
                  <View className="loading-spinner"></View>
                  生成中…
                </>
              ) : '🚀 开始第一章'}
            </Button>
          </View>
        )}
        
        {/* 章节列表 */}
        {chapters.map((ch, i) => {
          const isLast = i === chapters.length - 1
          return (
            <View key={ch.id} className="chapter">
              <Text className="chapter-index">第 {ch.index} 章</Text>
              <Text className="chapter-title">{ch.title}</Text>
              <Text className="chapter-content">{ch.content}</Text>
              
              {/* 分支选择区域（仅最后章节显示）*/}
              {isLast && ch.branches.length > 0 && (
                <View className="branches">
                  <Text className="branches-label">选择下一步剧情发展：</Text>
                  {ch.branches.map((b) => (
                    <Button
                      key={b.id}
                      className="branch-btn"
                      onClick={() => onSelectBranch(b.text)}
                      disabled={generating}
                    >
                      {generating ? (
                        <>
                          <View className="loading-spinner"></View>
                          生成中…
                        </>
                      ) : b.text}
                    </Button>
                  ))}
                </View>
              )}
            </View>
          )
        })}
        
        {/* 🌟【修复点4】在这里渲染打字机实时预览章节 */}
        {typingChapter && (
          <View className="chapter generating-preview">
            <Text className="chapter-index">第 {typingChapter.index} 章</Text>
            <Text className="chapter-title">{typingChapter.title || '系统正在酝酿标题...'}</Text>
            <Text className="chapter-content">
              {typingChapter.content}
              {/* 加入一个闪烁的光标增加氛围感 */}
              <Text className="cursor">|</Text>
            </Text>
          </View>
        )}
        
        {/* 自定义分支输入 */}
        {lastChapter && lastChapter.branches.length > 0 && (
          <View className="custom-branch">
            <Text className="custom-label">发挥创意，自定义剧情：</Text>
            <Input
              className="custom-input"
              placeholder="例如：主角突然觉醒了神秘力量…"
              value={customBranch}
              onInput={(e) => {
                const value = e.detail.value
                setCustomBranch(value)
                setWordCount(value.length)
              }}
              maxlength={100}
            />
            <View className={`input-counter ${wordCount > 80 ? 'warning' : wordCount >= 100 ? 'limit' : ''}`}>
              {wordCount}/100字
            </View>
            <Button 
              className="btn-custom" 
              disabled={generating || !customBranch.trim()} 
              onClick={onCustomBranch}
            >
              {generating ? (
                <>
                  <View className="loading-spinner"></View>
                  生成中…
                </>
              ) : '🎯 按此分支续写'}
            </Button>
          </View>
        )}
        
        {/* 成功提示 */}
        {showSuccess && (
          <View className="success-message">
            <Text>🎉 章节生成完成！</Text>
          </View>
        )}
        
        {/* 错误信息 */}
        {error && <Text className="err">{error}</Text>}
      </ScrollView>
      <View className="footer">
        {chapters.length > 0 && (
          <>
            <Button 
              className="btn-export" 
              size="mini" 
              onClick={handleExport}
            >
              📤 导出全文
            </Button>
            <Button
              className="btn-reset"
              size="mini"
              onClick={() => {
                Taro.showModal({
                  title: '重新开始',
                  content: `确定要清空这${chapters.length}章精彩内容吗？此操作不可撤销。`,
                  confirmText: '确定清空',
                  cancelText: '取消',
                  success: (res) => {
                    if (res.confirm) {
                      resetStory()
                      Taro.showToast({ 
                        title: '故事已重置', 
                        icon: 'success' 
                      })
                    }
                  }
                })
              }}
            >
              🔄 重新开始
            </Button>
          </>
        )}
        <Button 
          className="btn-list" 
          size="mini" 
          onClick={() => Taro.redirectTo({ url: '/pages/story-list/index' })}
        >
          📚 故事列表
        </Button>
      </View>
    </View>
  )
}
