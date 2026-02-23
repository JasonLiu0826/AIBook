import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, Button, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { useUserConfig } from '@/store/userConfig'
import { useStory } from '@/store/story'
import { generateChapterStream, isGenerateApiConfigured, getMockFirstChapter, summarizeChapterNode } from '@/services/ai'
import type { Chapter, BranchOption } from '@/types'
import './index.scss'

/**
 * 🚀 生产级 Taro 聊天滚动 Hook
 * 适用于：
 * - AI token 流式
 * - 聊天 UI
 * - 小说生成 UI
 */
export function useChatScroll(isGenerating: boolean) {
  const [scrollTop, setScrollTop] = useState(0)
  const userLockedRef = useRef(false)
  const timerRef = useRef<any>(null)

  const forceScrollToBottom = useCallback(() => {
    userLockedRef.current = false
    setScrollTop(prev => prev >= 99999 ? 99998 : 99999) 
  }, [])

  const smartAutoScroll = useCallback(() => {
    if (userLockedRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setScrollTop(prev => prev >= 99999 ? prev + 1 : 99999) 
    }, 60)
  }, [])

  const onScroll = useCallback((e: any) => {
    const deltaY = e?.detail?.deltaY ?? 0
    if (deltaY < -2) userLockedRef.current = true
    if (deltaY > 2) userLockedRef.current = false
  }, [])

  return { scrollTop, forceScrollToBottom, smartAutoScroll, onScroll }
}

function genId() {
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function exportChaptersToText(chapters: Chapter[]): string {
  const timestamp = new Date().toLocaleString('zh-CN')
  const header = `📖 AI互动小说导出\n\n导出时间: ${timestamp}\n总章节数: ${chapters?.length || 0}章\n\n${'='.repeat(50)}\n\n`
  
  const content = (chapters || [])
    .map((ch, index) => {
      const divider = index === 0 ? '' : `\n${'─'.repeat(30)}\n\n`
      return `${divider}第 ${ch?.index || index + 1} 章 ${ch?.title || ''}\n\n${ch?.content || ''}`
    })
    .join('\n')
  
  const footer = `\n\n${'='.repeat(50)}\n\n📝 本故事由AIBook智能创作助手生成`  
  return header + content + footer
}

// ===== 新增: Markdown 格式化导出 =====
function exportChaptersToMarkdown(chapters: Chapter[]): string {
  const timestamp = new Date().toLocaleString('zh-CN')
  let md = `# 📖 AI互动小说导出\n\n> 导出时间: ${timestamp}\n> 总章节数: ${chapters?.length || 0}章\n\n---\n\n`;
  
  (chapters || []).forEach((ch, index) => {
    md += `## 第 ${ch?.index || index + 1} 章 ${ch?.title || ''}\n\n${ch?.content || ''}\n\n`;
    // 如果有用户选择的分支，也一并导出
    if (ch.selectedBranch) {
      md += `*👤 用户选择：${ch.selectedBranch}*\n\n`;
    }
  });
  
  md += `---\n\n*📝 本故事由AIBook智能创作助手生成*`;
  return md;
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
    loadStoryList,
    updateLastChapterChoice
  } = useStory()
  
  const [customBranch, setCustomBranch] = useState('')
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  
  // 🌟 控制自定义 ActionSheet 的显示状态
  const [showExportSheet, setShowExportSheet] = useState(false)
    
  const [typingChapter, setTypingChapter] = useState<Partial<Chapter> | null>(null)
  
  const { 
    scrollTop, 
    forceScrollToBottom, 
    smartAutoScroll, 
    onScroll
  } = useChatScroll(generating);
  
  useEffect(() => {
    if (typingChapter) smartAutoScroll()
  }, [typingChapter, smartAutoScroll])

  const apiConfigured = isGenerateApiConfigured(config.aiProvider, config.apiKey)
  const lastChapter = useMemo(() => chapters?.[chapters.length - 1], [chapters])
  
  const contextSummary = useMemo(() => {
    if (!chapters || chapters.length === 0) return undefined
    const lastFew = chapters
      .slice(-3)
      .map((c) => `【${c?.title || ''}】${c?.content?.slice(0, 200) || ''}…`)
      .join('\n')
    return lastFew
  }, [chapters])

  useEffect(() => {
    loadStoryList()
  }, [loadStoryList])

  const doGenerate = async (chosenBranch?: string) => {
    forceScrollToBottom();
    if (chosenBranch && chapters?.length) {
      updateLastChapterChoice(chosenBranch) 
    }
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
              smartAutoScroll()
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
      
      if (config.apiKey) {
        summarizeChapterNode(chapter.title, chapter.content, config.apiKey)
          .then(summary => {
            if (summary && summary.trim()) {
              const currentNodes = settings.storyNodes || '';
              const newNodeEntry = `- 第${chapter.index}章：${summary}`;
              const updatedNodes = currentNodes + (currentNodes ? '\n' : '') + newNodeEntry;
              settings.storyNodes = updatedNodes;
              saveSettings();
            }
          }).catch(err => { console.error('剧情总结失败:', err); });
      }
      
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

  // ==================== 导出功能核心逻辑 ====================
  
  // 1. 复制纯文本
  const handleCopyText = async () => {
    if (!chapters || chapters.length === 0) return
    Taro.showLoading({ title: '正在提取文字...' })
    try {
      const text = exportChaptersToText(chapters)
      await Taro.setClipboardData({ data: text })
      setShowExportSheet(false)
      Taro.showToast({ title: '已复制到剪贴板', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: '复制失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  // 2. 导出为本地文件 (TXT/Markdown) 并调用微信分享
  const exportAsFile = async (type: 'txt' | 'md') => {
    if (!chapters || chapters.length === 0) return
    Taro.showLoading({ title: `正在生成${type.toUpperCase()}...` })
    
    try {
      const content = type === 'md' ? exportChaptersToMarkdown(chapters) : exportChaptersToText(chapters)
      const fs = Taro.getFileSystemManager()
      const title = lastChapter?.title ? lastChapter.title.slice(0, 10) : '互动小说'
      const fileName = `${title}_导出.${type}`
      const filePath = `${Taro.env.USER_DATA_PATH}/${fileName}`
      
      fs.writeFileSync(filePath, content, 'utf8')
      Taro.hideLoading()
      setShowExportSheet(false)
      
      if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
        // 使用 (Taro as any) 绕过类型检查，Taro 底层会完美代理原生的 wx.shareFileMessage
        (Taro as any).shareFileMessage({
          filePath: filePath,
          fileName: fileName,
          success: () => console.log('文件分享成功'),
          fail: (err: any) => {  // 👈 这里加上 : any 解决隐式报错
            console.error('分享失败', err)
            Taro.showToast({ title: '已取消分享', icon: 'none' })
          }
        })
      } else {
        Taro.showToast({ title: '当前环境不支持文件分享', icon: 'none' })
      }
    } catch (error) {
      console.error('导出文件失败:', error)
      Taro.hideLoading()
      Taro.showToast({ title: '生成文件失败', icon: 'error' })
    }
  }

  // 3. 生成长图
  const handleExportImage = () => {
    setShowExportSheet(false)
    Taro.showLoading({ title: '绘制中...' })
    // TODO: 预留给 wxml-to-canvas 渲染
    setTimeout(() => {
      Taro.hideLoading()
      Taro.showToast({ title: '长图模块准备中，敬请期待', icon: 'none', duration: 2500 })
    }, 1000)
  }

  // 4. App专属不可用提示
  const handleDisabledAppExport = () => {
    Taro.showToast({ title: '仅供App功能开放', icon: 'error', duration: 2000 })
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

      <ScrollView 
        scrollY 
        className="scroll" 
        scrollTop={scrollTop}
        scrollWithAnimation={!generating}
        onScroll={onScroll}
      >
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
        
        {chapters?.map((ch, i) => {
          const isLast = i === chapters.length - 1
          return (
            <View key={ch?.id || i} className="chapter">
              <Text className="chapter-index">第 {ch?.index || i + 1} 章</Text>
              <Text className="chapter-title">{ch?.title}</Text>
              <Text className="chapter-content">{ch?.content}</Text>
              
              {ch.selectedBranch ? (
                <View className="user-message-bubble">
                  <Text>{ch.selectedBranch}</Text>
                </View>
              ) : (
                isLast && ch?.branches?.length > 0 && !generating && (
                  <View className="branches">
                    <Text className="branches-label">选择下一步剧情发展：</Text>
                    {ch.branches.map((b, idx) => {
                      const text = typeof b === 'string' ? b : b?.text;
                      const id = typeof b === 'string' ? `b_${idx}` : (b?.id || `b_${idx}`);
                      return (
                        <Button key={id} className="branch-btn" onClick={() => onSelectBranch(text)}>
                          {text}
                        </Button>
                      )
                    })}
                  </View>
                )
              )}
            </View>
          )
        })}
        
        {typingChapter && (
          <View id="typing-chapter" className="chapter generating-preview">
            <Text className="chapter-index">第 {typingChapter.index} 章</Text>
            <Text className="chapter-title">{typingChapter.title || '系统正在酝酿标题...'}</Text>
            <Text className="chapter-content">
              {typingChapter.content}
              <Text className="cursor">|</Text>
            </Text>
          </View>
        )}
        
        {showSuccess && (
          <View className="success-message">
            <Text>🎉 章节生成完成！</Text>
          </View>
        )}
              
        {error && <Text className="err">{error}</Text>}
      </ScrollView>

      {/* 底部导航栏与汉堡菜单 */}
      <View className="footer-container">
        <View className="custom-input-row">
          {lastChapter && lastChapter?.branches?.length > 0 && !lastChapter.selectedBranch && !generating ? (
            <>
              <Input
                className="custom-input"
                placeholder="自定义下一步剧情..."
                value={customBranch}
                onInput={(e) => setCustomBranch(e.detail.value)}
                maxlength={100}
              />
              <Button 
                className="btn-send" 
                disabled={!customBranch.trim()} 
                onClick={onCustomBranch}
              >
                发送
              </Button>
            </>
          ) : (
            <View className="flex-spacer" style={{ flex: 1 }}></View>
          )}

          <View className={`btn-menu-modern ${showMenu ? 'active' : ''}`} onClick={() => setShowMenu(!showMenu)}>
            <View className="menu-bar bar-top"></View>
            <View className="menu-bar bar-middle"></View>
            <View className="menu-bar bar-bottom"></View>
          </View>
        </View>

        <View className={`footer-actions-panel ${showMenu ? 'show' : ''}`}>
          {chapters?.length > 0 && (
            <>
              <Button className="action-btn" size="mini" onClick={() => { forceScrollToBottom(); setShowMenu(false); }}>
                ⬇️ 直达底部
              </Button>
              <Button className="action-btn" size="mini" onClick={() => { setShowExportSheet(true); setShowMenu(false); }}>
                📤 导出
              </Button>
              <Button 
                className="action-btn" 
                size="mini" 
                onClick={() => {
                  setShowMenu(false);
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
                🔄 重启
              </Button>
            </>
          )}
          <Button className="action-btn primary" size="mini" onClick={() => Taro.redirectTo({ url: '/pages/story-list/index' })}>
            📚 故事列表
          </Button>
        </View>
      </View>

      {/* ================= 自定义导出动作面板 ================= */}
      <View 
        className={`export-sheet-mask ${showExportSheet ? 'show' : ''}`} 
        onClick={() => setShowExportSheet(false)}
      ></View>
      <View className={`export-sheet ${showExportSheet ? 'show' : ''}`}>
        <View className="sheet-header">
          <Text>选择导出方式</Text>
        </View>
        
        <View className="sheet-body">
          <View className="sheet-item" onClick={handleCopyText}>
            <Text className="item-text">📄 复制生成纯文本</Text>
          </View>
          <View className="sheet-item" onClick={() => exportAsFile('txt')}>
            <Text className="item-text">📁 发送 TXT 文本文件</Text>
          </View>
          <View className="sheet-item" onClick={() => exportAsFile('md')}>
            <Text className="item-text">📝 发送 Markdown 文件</Text>
          </View>
          <View className="sheet-item" onClick={handleExportImage}>
            <Text className="item-text">🖼️ 生成排版长图</Text>
          </View>
          
          {/* 灰色禁用的 App 专属按钮 */}
          <View className="sheet-item disabled" onClick={handleDisabledAppExport}>
            <Text className="item-text">📑 导出 PDF 文件</Text>
            <Text className="tag-app">App专属</Text>
          </View>
          <View className="sheet-item disabled" onClick={handleDisabledAppExport}>
            <Text className="item-text">📚 导出 EPUB 电子书</Text>
            <Text className="tag-app">App专属</Text>
          </View>
        </View>
        
        <View className="sheet-footer" onClick={() => setShowExportSheet(false)}>
          取消
        </View>
      </View>

    </View>
  )
}