import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, Button, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { useUserConfig } from '@/store/userConfig'
import { useStory } from '@/store/story'
import { generateChapterStream, isGenerateApiConfigured, getMockFirstChapter, summarizeChapterNode } from '@/services/ai'
import { getAdaptivePaddingBottom } from '@/utils/system'
import type { Chapter, BranchOption } from '@/types'
import './index.scss'

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

function exportChaptersToMarkdown(chapters: Chapter[]): string {
  const timestamp = new Date().toLocaleString('zh-CN')
  let md = `# 📖 AI互动小说导出

> 导出时间: ${timestamp}
> 总章节数: ${chapters?.length || 0}章

---

`;
  
  (chapters || []).forEach((ch, index) => {
    md += `## 第 ${ch?.index || index + 1} 章 ${ch?.title || ''}

${ch?.content || ''}

`;
    if (ch.selectedBranch) {
      md += `*👤 用户选择：${ch.selectedBranch}*\n\n`;
    }
  });
  
  md += `---\n\n*📝 本故事由AIBook智能创作助手生成*`;
  return md;
}

// 🌟 1. 高级选项嗅探器 (Sentinel Detector)
// 用于在 AI 流式输出时，提前发现选项的苗头，并返回截断索引
function findOptionStartIndex(text: string): number | null {
  if (!text || text.length < 30) return null; // 避免文章开头误伤
  
  // 寻找引导语 (抛弃结尾 $ 限制，只要出现就算)
  const guideReg = /(?:^|\n|\s{2,}|[。！？\.\!\?”」]\s*)(?:请选择|下一步|分支选项|选项|剧情分支|你的选择|你决定|你会|请决定|接下来|(?:你)?可以选择)(?:[：:\s])/i;
  const guideMatch = text.match(guideReg);
  let idx1 = guideMatch && guideMatch.index !== undefined && guideMatch.index > text.length * 0.3 
    ? guideMatch.index + (/^[。！？\.\!\?”」]/.test(guideMatch[0]) ? 1 : 0) : null;

  // 寻找选项列表 (如 A. / 1. / ①)
  const listReg = /(?:^|\n|\s{2,}|[。！？\.\!\?”」]\s*)(?:\*\*?)?(?:选项)?(?:[A-Da-d]|[1-4]|[①-④])(?:\*\*?)?[\.、：:\)）]/i;
  const listMatch = text.match(listReg);
  let idx2 = listMatch && listMatch.index !== undefined && listMatch.index > text.length * 0.3
    ? listMatch.index + (/^[。！？\.\!\?”」]/.test(listMatch[0]) ? 1 : 0) : null;
    
  if (idx1 !== null && idx2 !== null) return Math.min(idx1, idx2);
  return idx1 !== null ? idx1 : idx2;
}

// 🌟 2. 保留给历史记录和最终入库洗白用的包裹函数
function cleanChapterContent(text: string): string {
  const idx = findOptionStartIndex(text);
  return idx !== null ? text.slice(0, idx).trim() : text.trim();
}

export default function StoryPage() {
  const { settings, attachedFiles, save: saveSettings } = useSettings()
  const { config } = useUserConfig()
  
  // 🌟 新增：记录选项开始的位置，用于永久冻结后续正文的渲染
  const optionStartIndexRef = useRef<number | null>(null);
  
  // 🌟 1. 通用震动辅助函数
  const triggerVibrate = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (config.enableVibration === false) return;
    Taro.vibrateShort({ type }).catch(() => {});
  }, [config.enableVibration]);

  // 🌟 2. AI 流式打字节流震动
  const lastVibrateTimeRef = useRef<number>(0);
  const vibrateTyping = useCallback(() => {
    if (config.enableVibration === false) return;
    const now = Date.now();
    if (now - lastVibrateTimeRef.current > 150) {
      Taro.vibrateShort({ type: 'light' }).catch(() => {});
      lastVibrateTimeRef.current = now;
    }
  }, [config.enableVibration]);

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
  const [showExportSheet, setShowExportSheet] = useState(false)
  const [typingChapter, setTypingChapter] = useState<Partial<Chapter> | null>(null)
  
  const { scrollTop, forceScrollToBottom, smartAutoScroll, onScroll } = useChatScroll(generating);
  
  useEffect(() => {
    if (typingChapter) smartAutoScroll()
  }, [typingChapter, smartAutoScroll])

  const apiConfigured = isGenerateApiConfigured(config.aiProvider, config.apiKey)
  const lastChapter = useMemo(() => chapters?.[chapters.length - 1], [chapters])
  
  const contextSummary = useMemo(() => {
    if (!chapters || chapters.length === 0) return undefined
    const lastFew = chapters.slice(-3).map((c) => `【${c?.title || ''}】${c?.content?.slice(0, 200) || ''}…`).join('\n')
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
    optionStartIndexRef.current = null; // 🌟 每次生成前强制重置冻结标记
    let loadingShown = false
    let errorToast: { title: string; icon: 'none' | 'success', duration: number } | null = null
    
    try {
      Taro.showLoading({ title: '正在构思剧情...', mask: true })
      loadingShown = true
      
      if (!settings.characters || settings.characters.trim().length === 0) {
        throw new Error('请先在后台设定中完善人物设定')
      }
      
      await saveSettings()
      
      // 👇 核心拼装逻辑：把外部导入的文件以特定的 Prompt 结构拼接到底层设定中
      const finalSettings = { ...settings }
      if (attachedFiles) {
        Object.keys(finalSettings).forEach((key) => {
          const k = key as keyof typeof attachedFiles;
          if (attachedFiles[k]) {
            // 如果某一项有附件，就在文本框内容后面追加附件的内容
            finalSettings[k] += `\n\n【补充参考附件：${attachedFiles[k]?.name}】\n${attachedFiles[k]?.content}`
          }
        })
      }

      setTypingChapter({ index: (chapters?.length || 0) + 1, title: '', content: '' })
      
      let partialTitle = '';
      let partialContent = '';
      let partialBranches: string[] = [];
      
      const result = await generateChapterStream(
        {
          settings: finalSettings, // 🌟 这里一定要用 finalSettings 替换原来的 settings
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
              
              // ⭐ 终极优化：选项嗅探器 (Sentinel Detector)
              // 实时监测，一旦发现选项苗头，立刻锁死当前索引
              if (optionStartIndexRef.current === null) {
                const startIdx = findOptionStartIndex(partialContent);
                if (startIdx !== null) {
                  optionStartIndexRef.current = startIdx;
                }
              }

              // ⭐ 结构驱动渲染：只要被标记冻结了，后面的内容再多也绝不渲染
              let display = partialContent;
              if (optionStartIndexRef.current !== null) {
                display = partialContent.slice(0, optionStartIndexRef.current);
              }

              setTypingChapter(prev => prev ? { ...prev, content: display.trim() } : null)
              smartAutoScroll()
              vibrateTyping() 
              break;
            case 'branches':
              try { 
                partialBranches = JSON.parse(partialData.value);
                // ⭐ 语义截断兜底：哪怕嗅探器漏掉了，收到 branches 信号立刻冻结渲染
                if (optionStartIndexRef.current === null) {
                  optionStartIndexRef.current = partialContent.length;
                }
                console.log('✅ 成功解析分支数据:', partialBranches);
              } catch (e) {
                console.error('❌ 分支数据解析失败:', partialData.value, e);
              }
              break;
          }
        }
      )
      
      setTypingChapter(null)
      
      if (!result.title || !result.content) throw new Error('AI返回的内容格式异常，请重试')
      
      // 🌟 修复：使用我们自己在回调中捕获到的partialBranches作为第一优先级
      const finalBranchesArray = (result.branches && result.branches.length > 0) 
        ? result.branches 
        : (partialBranches && partialBranches.length > 0 ? partialBranches : ["继续探索", "停下思考", "另寻出路"]); // 给一个明确的兜底
      
      console.log('📊 最终使用的分支数据:', { 
        resultBranches: result.branches, 
        partialBranches, 
        finalBranchesArray 
      });
      
      const chapter: Chapter = {
        id: genId(),
        index: (chapters?.length || 0) + 1,
        title: result.title,
        // 🌟 最终存入记录时，严格应用冻结索引截断，防止脏数据入库
        content: optionStartIndexRef.current !== null 
          ? result.content.slice(0, optionStartIndexRef.current).trim() 
          : cleanChapterContent(result.content), // 👈 存入极其干净的正文
        branches: finalBranchesArray.map((text: string, i: number) => ({ 
          id: `b_${i}`, 
          text, 
          isCustom: false 
        })) as BranchOption[],
        createdAt: Date.now()
      }
      
      addChapter(chapter)
      setShowSuccess(true)
      
      if (config.apiKey) {
        summarizeChapterNode(chapter.title, chapter.content, config.apiKey).then(summary => {
          if (summary && summary.trim()) {
            const currentNodes = settings.storyNodes || '';
            settings.storyNodes = currentNodes + (currentNodes ? '\n' : '') + `- 第${chapter.index}章：${summary}`;
            saveSettings();
          }
        }).catch(() => {});
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

  const onStart = () => { triggerVibrate('medium'); doGenerate() }
  
  const onSelectBranch = (text: string) => {
    triggerVibrate('medium');
    setCustomBranch('')
    setShowSuccess(false)
    doGenerate(text)
  }
  
  const onCustomBranch = () => {
    triggerVibrate('medium');
    const t = customBranch.trim()
    if (!t) return Taro.showToast({ title: '请输入您想要的剧情走向', icon: 'none' })
    if (t.length < 5) return Taro.showToast({ title: '描述太短啦，至少5个字哦', icon: 'none' })
    onSelectBranch(t)
  }

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
    } finally { Taro.hideLoading() }
  }

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
        (Taro as any).shareFileMessage({
          filePath, fileName,
          success: () => {},
          fail: () => Taro.showToast({ title: '已取消分享', icon: 'none' })
        })
      } else {
        Taro.showToast({ title: '当前环境不支持文件分享', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: '生成文件失败', icon: 'error' })
    }
  }

  const handleExportImage = () => {
    setShowExportSheet(false)
    Taro.showLoading({ title: '绘制中...' })
    setTimeout(() => {
      Taro.hideLoading()
      Taro.showToast({ title: '长图模块准备中，敬请期待', icon: 'none', duration: 2500 })
    }, 1000)
  }

  if (!currentStoryId) {
    return (
      <View className="page-story no-current">
        <View className="empty">
          <Text className="empty-icon">📚</Text>
          <Text className="empty-title">请选择或新建故事</Text>
          <Text className="empty-desc">在故事列表中新建一本精彩的互动小说，或选择已有故事继续您的冒险之旅</Text>
          <Button className="btn-start" onClick={() => { triggerVibrate('medium'); Taro.navigateTo({ url: '/pages/story-list/index' }) }}>
            浏览故事列表
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="page-story">
      <ScrollView scrollY className="scroll" scrollTop={scrollTop} scrollWithAnimation={!generating} onScroll={onScroll}>
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
              {generating ? <><View className="loading-spinner"></View>生成中…</> : '🚀 开始第一章'}
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
                <View className="user-message-bubble"><Text>{ch.selectedBranch}</Text></View>
              ) : (
                isLast && ch?.branches?.length > 0 && !generating && (
                  <View className="branches">
                    <Text className="branches-label">选择下一步剧情发展：</Text>
                    {ch.branches.map((b, idx) => {
                      // 强制转换为对象类型，避免 typeof 误判，并提供明确的降级日志
                      const branchItem = b as BranchOption; 
                      const text = branchItem?.text || `未知分支 ${idx + 1}`; 
                      const id = branchItem?.id || `b_${idx}`;
                      
                      // 添加调试日志
                      if (!branchItem?.text) {
                        console.warn('分支数据异常:', { branchItem, idx, branches: ch.branches });
                      }
                      
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
            <Text className="chapter-content">{typingChapter.content}<Text className="cursor">|</Text></Text>
          </View>
        )}
        
        {showSuccess && <View className="success-message"><Text>🎉 章节生成完成！</Text></View>}
        {error && <Text className="err">{error}</Text>}
      </ScrollView>

      <View 
        className="footer-container" 
        style={{ paddingBottom: getAdaptivePaddingBottom(24) }}
      >
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
              <Button className="btn-send" disabled={!customBranch.trim()} onClick={onCustomBranch}>发送</Button>
            </>
          ) : (
            <View className="flex-spacer" style={{ flex: 1 }}></View>
          )}

          <View className={`btn-menu-modern ${showMenu ? 'active' : ''}`} onClick={() => { triggerVibrate('light'); setShowMenu(!showMenu); }}>
            <View className="menu-bar bar-top"></View>
            <View className="menu-bar bar-middle"></View>
            <View className="menu-bar bar-bottom"></View>
          </View>
        </View>

        <View className={`footer-actions-panel ${showMenu ? 'show' : ''}`}>
          {chapters?.length > 0 && (
            <>
              <Button className="action-btn" size="mini" onClick={() => { triggerVibrate('medium'); forceScrollToBottom(); setShowMenu(false); }}>⬇️ 直达底部</Button>
              <Button className="action-btn" size="mini" onClick={() => { triggerVibrate('medium'); setShowExportSheet(true); setShowMenu(false); }}>📤 导出</Button>
              <Button className="action-btn" size="mini" onClick={() => { triggerVibrate('medium'); setShowMenu(false); Taro.showModal({ title: '重新开始', content: '确定清空并重新开始吗？', confirmColor: '#d9534f', success: (res) => { if (res.confirm) { resetStory(); Taro.showToast({ title: '已清空', icon: 'success' }) } } }) }}>🔄 重启</Button>
            </>
          )}
          <Button className="action-btn primary" size="mini" onClick={() => { triggerVibrate('medium'); Taro.redirectTo({ url: '/pages/story-list/index' }) }}>📚 故事列表</Button>
        </View>
      </View>

      <View className={`export-sheet-mask ${showExportSheet ? 'show' : ''}`} onClick={() => setShowExportSheet(false)}></View>
      <View className={`export-sheet ${showExportSheet ? 'show' : ''}`}>
        <View className="sheet-header"><Text>选择导出方式</Text></View>
        <View className="sheet-body">
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); handleCopyText(); }}><Text className="item-text">📄 复制生成纯文本</Text></View>
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); exportAsFile('txt'); }}><Text className="item-text">📁 导出 TXT 文本文件</Text></View>
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); exportAsFile('md'); }}><Text className="item-text">📝 导出 Markdown 文件</Text></View>
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); handleExportImage(); }}><Text className="item-text">🖼️ 生成排版长图</Text></View>
          <View className="sheet-item disabled" onClick={() => { triggerVibrate('medium'); Taro.showToast({ title: '仅供App功能开放', icon: 'error' }) }}><Text className="item-text">📑 导出 PDF 文件</Text><Text className="tag-app">App专属</Text></View>
          <View className="sheet-item disabled" onClick={() => { triggerVibrate('medium'); Taro.showToast({ title: '仅供App功能开放', icon: 'error' }) }}><Text className="item-text">📚 导出 EPUB 电子书</Text><Text className="tag-app">App专属</Text></View>
        </View>
        <View className="sheet-footer" onClick={() => setShowExportSheet(false)}>取消</View>
      </View>
    </View>
  )
}