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
总章节数: ${chapters?.length || 0}章

${'='.repeat(50)}

`
  
  const content = (chapters || [])
    .map((ch, index) => {
      const divider = index === 0 ? '' : `\n${'─'.repeat(30)}\n\n`
      return `${divider}第 ${ch?.index || index + 1} 章 ${ch?.title || ''}\n\n${ch?.content || ''}`
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
  
  const [typingChapter, setTypingChapter] = useState<Partial<Chapter> | null>(null)

  const apiConfigured = isGenerateApiConfigured(config.aiProvider, config.apiKey)
  const lastChapter = useMemo(() => chapters?.[chapters.length - 1], [chapters])
  
  // 🌟 修复点 1：摘要加防崩溃保护
  const contextSummary = useMemo(() => {
    if (!chapters || chapters.length === 0) return undefined
    const lastFew = chapters
      .slice(-3)
      .map((c) => `【${c?.title || ''}】${c?.content?.slice(0, 200) || ''}…`)
      .join('\n')
    return lastFew
  }, [chapters])
  
  // 🌟 修复点 2：字数统计加防崩溃保护
  const totalWordCount = useMemo(() => {
    return chapters?.reduce((total, chapter) => total + (chapter?.content?.length || 0), 0) || 0
  }, [chapters])
  
  const branchSuggestions = useMemo(() => {
    if (lastChapter?.branches?.length) {
      return lastChapter.branches.slice(0, 2).map(b => typeof b === 'string' ? b : b?.text)
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
      
      setTypingChapter({ index: (chapters?.length || 0) + 1, title: '', content: '' })
      
      let partialTitle = '';
      let partialContent = '';
      let partialBranches: string[] = [];
      
      const result = await generateChapterStream(
        {
          settings,
          userConfig: config,
          contextSummary,
          chosenBranch,
          nextChapterIndex: (chapters?.length || 0) + 1
        },
        (partialData) => {
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
      
      setTypingChapter(null)
      
      if (!result.title || !result.content) {
        throw new Error('AI返回的内容格式异常，请重试')
      }
      
      const chapter: Chapter = {
        id: genId(),
        index: (chapters?.length || 0) + 1,
        title: result.title,
        content: result.content,
        branches: (result.branches || []).map((text, i) => ({ id: `b_${i}`, text, isCustom: false })) as BranchOption[],
        createdAt: Date.now()
      }
      
      addChapter(chapter)
      setShowSuccess(true)
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败，请稍后重试'
      setError(msg)
      setTypingChapter(null) 
      
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
      Taro.showToast({ title: '请输入您想要的剧情走向', icon: 'none' })
      return
    }
    if (t.length < 5) {
      Taro.showToast({ title: '描述太短啦，至少5个字哦', icon: 'none' })
      return
    }
    onSelectBranch(t)
  }

  const handleExport = async () => {
    if (!chapters || chapters.length === 0) {
      Taro.showToast({ title: '暂无内容可导出', icon: 'none' })
      return
    }
    
    let loadingShown = false
    try {
      Taro.showLoading({ title: '正在导出...' })
      loadingShown = true
      const text = exportChaptersToText(chapters)
      
      await Taro.setClipboardData({ data: text })
      
      Taro.showToast({ 
        title: `已导出${chapters.length}章内容到剪贴板`, 
        icon: 'success',
        duration: 2500
      })
    } catch (error) {
      console.error('导出失败:', error)
      Taro.showToast({ title: '导出失败，请重试', icon: 'none' })
    } finally {
      if (loadingShown) Taro.hideLoading()
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
        {!apiConfigured && (!chapters || chapters.length === 0) && (
          <View className="api-tip">
            <Text>💡 温馨提示：您尚未配置AI生成接口，系统将为您展示精彩的故事示例。配置后端接口后即可享受完整的AI创作体验！</Text>
          </View>
        )}
        
        {(!chapters || chapters.length === 0) && (
          <View className="empty">
            <Text className="empty-icon">✨</Text>
            <Text className="empty-title">开启您的创作之旅</Text>
            <Text className="empty-desc">基于您精心设定的世界观和人物，AI将为您编织独一无二的互动故事。点击下方按钮开始创作吧！</Text>
            <Button className="btn-start" disabled={generating} onClick={onStart}>
              {generating ? (
                <><View className="loading-spinner"></View>生成中…</>
              ) : '🚀 开始第一章'}
            </Button>
          </View>
        )}
        
        {/* 🌟 修复点 3：遍历列表时防旧数据格式崩溃 */}
        {chapters?.map((ch, i) => {
          const isLast = i === chapters.length - 1
          return (
            <View key={ch?.id || i} className="chapter">
              <Text className="chapter-index">第 {ch?.index || i + 1} 章</Text>
              <Text className="chapter-title">{ch?.title}</Text>
              <Text className="chapter-content">{ch?.content}</Text>
              
              {isLast && ch?.branches?.length > 0 && (
                <View className="branches">
                  <Text className="branches-label">选择下一步剧情发展：</Text>
                  {/* 🌟 修复点 4：兼容老旧的单纯字符串分支格式 */}
                  {ch.branches.map((b, idx) => {
                    const text = typeof b === 'string' ? b : b?.text;
                    const id = typeof b === 'string' ? `b_${idx}` : (b?.id || `b_${idx}`);
                    
                    return (
                      <Button
                        key={id}
                        className="branch-btn"
                        onClick={() => onSelectBranch(text)}
                        disabled={generating}
                      >
                        {generating ? (
                          <><View className="loading-spinner"></View>生成中…</>
                        ) : text}
                      </Button>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })}
        
        {typingChapter && (
          <View className="chapter generating-preview">
            <Text className="chapter-index">第 {typingChapter.index} 章</Text>
            <Text className="chapter-title">{typingChapter.title || '系统正在酝酿标题...'}</Text>
            <Text className="chapter-content">
              {typingChapter.content}
              <Text className="cursor">|</Text>
            </Text>
          </View>
        )}
        
        {/* 🌟 修复点 5：这里是被截断的自定义分支输入安全判断 */}
        {lastChapter && lastChapter?.branches?.length > 0 && (
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
                <><View className="loading-spinner"></View>生成中…</>
              ) : '🎯 按此分支续写'}
            </Button>
          </View>
        )}
        
        {showSuccess && (
          <View className="success-message">
            <Text>🎉 章节生成完成！</Text>
          </View>
        )}
        
        {error && <Text className="err">{error}</Text>}
      </ScrollView>
      <View className="footer">
        {chapters?.length > 0 && (
          <>
            <Button className="btn-export" size="mini" onClick={handleExport}>
              📤 导出全文
            </Button>
            <Button
              className="btn-reset"
              size="mini"
              onClick={() => {
                Taro.showModal({
                  title: '重新开始',
                  content: '确定要清空当前故事并重新开始吗？此操作不可恢复。',
                  confirmColor: '#d9534f',
                  success: (res) => {
                    if (res.confirm) {
                      resetStory()
                      Taro.showToast({ title: '已清空故事', icon: 'success' })
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
           