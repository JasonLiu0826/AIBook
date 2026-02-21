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
    let errorToast: { title: string; icon: 'success' | 'loading' | 'none'; duration: number } | null = null
    
    try {
      // 显示加载提示
      Taro.showLoading({ title: '正在编织精彩故事...' })
      loadingShown = true
      
      // 检查必要配置
      if (!settings.characters || settings.characters.trim().length === 0) {
        throw new Error('请先在后台设定中完善人物设定')
      }
      
      if (!settings.worldview || settings.worldview.trim().length === 0) {
        throw new Error('请先在后台设定中完善世界观设定')
      }
      
      await saveSettings()
      // 使用流式生成
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
          switch (partialData.type) {
            case 'title':
              partialTitle = partialData.value;
              // 实时更新标题显示
              break;
            case 'content':
              partialContent += partialData.value;
              // 实时更新内容显示（打字机效果）
              break;
            case 'branches':
              try {
                partialBranches = JSON.parse(partialData.value);
              } catch (e) {
                console.error('解析分支数据失败:', e);
              }
              break;
            case 'complete':
              // 生成完成
              break;
            case 'error':
              setError(partialData.value || '生成意外中断');
              break;
          }
        }
      )
      
      // 验证返回结果
      if (!result.title || !result.content) {
        throw new Error('AI返回的内容格式异常，请重试')
      }
      
      const chapter: Chapter = {
        id: genId(),
        index: chapters.length + 1,
        title: result.title,
        content: result.content,
        branches: result.branches.map((text, i) => ({
          id: `b_${i}`,
          text,
          isCustom: false
        })) as BranchOption[],
        createdAt: Date.now()
      }
      
      addChapter(chapter)
      setShowSuccess(true)
      
      // 平滑滚动到底部显示新章节
      setTimeout(() => {
        // 注意：小程序环境中可能没有document对象
        // 这里保留原生方法供H5使用，小程序使用Taro的API
        if (typeof document !== 'undefined') {
          const scrollView = document.querySelector('.scroll')
          if (scrollView) {
            scrollView.scrollTop = scrollView.scrollHeight
          }
        }
      }, 300)
      
      // 成功提示
      Taro.showToast({ 
        title: `第${chapter.index}章创作完成！`, 
        icon: 'success',
        duration: 2000
      })
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败，请稍后重试'
      setError(msg)
      console.error('生成失败:', e)
      
      // 先记录要展示的 toast，在 finally 里 hideLoading 之后再展示，保证 showLoading/hideLoading 配对
      let toastTitle = msg
      let toastDuration = 3000
      if (msg.includes('网络') || msg.includes('连接') || msg.includes('fetch')) {
        toastTitle = '网络连接失败，请检查后端是否启动及 AIBOOK_API_BASE 是否为本机局域网 IP'
      } else if (msg.includes('配置')) {
        toastTitle = msg
        toastDuration = 4000
      } else if (msg.includes('超时')) {
        toastTitle = '请求超时，请稍后再试'
      }
      errorToast = { title: toastTitle, icon: 'none', duration: toastDuration }
    } finally {
      setGenerating(false)
      // 必须先 hideLoading 再 showToast，否则小程序会报 showLoading/hideLoading 未配对
      if (loadingShown) {
        Taro.hideLoading()
      }
      if (errorToast) {
        Taro.showToast({
          title: errorToast.title,
          icon: errorToast.icon,
          duration: errorToast.duration
        })
      }
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
