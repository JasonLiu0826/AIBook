import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, Button, Input, ScrollView, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { useUserConfig } from '@/store/userConfig'
import { useStory } from '@/store/story'
import { generateChapterStream, isGenerateApiConfigured, getMockFirstChapter, summarizeChapterNode, smartAppendStoryNode } from '@/services/ai'
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

// 🌟 企业级排版引擎：文本换行与测量
function measureTextHeight(
  ctx: any,
  text: string,
  maxWidth: number,
  lineHeight: number
): number {
  if (!text) return 0;
  const paragraphs = text.split('\n');
  let totalHeight = 0;

  for (const p of paragraphs) {
    if (!p.trim()) {
      totalHeight += lineHeight; // 空行
      continue;
    }
    let line = '';
    for (let i = 0; i < p.length; i++) {
      const testLine = line + p[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        line = p[i];
        totalHeight += lineHeight;
      } else {
        line = testLine;
      }
    }
    totalHeight += lineHeight;
  }
  return totalHeight;
}

// 🌟 企业级排版引擎：实际绘制文本
function drawWrappedText(
  ctx: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  if (!text) return y;
  const paragraphs = text.split('\n');
  let currentY = y;

  for (const p of paragraphs) {
    if (!p.trim()) {
      currentY += lineHeight;
      continue;
    }
    let line = '';
    for (let i = 0; i < p.length; i++) {
      const testLine = line + p[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY);
        line = p[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
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

// 🌟 新增：拦截大模型喜欢输出的【全知视角】、【环境描写】等元数据结构标记
function filterAIMetaText(text: string): string {
  if (!text) return '';
  // 匹配并删除带有特殊写作解析的【】内容，避免污染正文
  return text.replace(/【[^】]*(视角|描写|转场|切换|解析|心理|旁白|分析|画外音|特写|镜头|提示|说明)[^】]*】/g, '');
}

// 🌟 修改：保留给历史记录和最终入库洗白用的包裹函数
function cleanChapterContent(text: string): string {
  const idx = findOptionStartIndex(text);
  let res = idx !== null ? text.slice(0, idx) : text;
  // 在入库前彻底抹除元数据
  return filterAIMetaText(res).trim();
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
    currentStoryTitle, // 🌟 新增这一行：获取当前故事标题
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

              // 👇 🌟 新增这一行：在打字机预览时，实时静音【全知视角】这类元文字
              display = filterAIMetaText(display);

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
        summarizeChapterNode(chapter.title, chapter.content, config.apiKey).then(async (newNode) => {
          if (newNode && newNode.trim()) {
            // 使用智能压缩机制更新故事节点
            const updatedNodesText = await smartAppendStoryNode(
              settings.storyNodes || '', 
              `- 第${chapter.index}章：${newNode}`, 
              config.apiKey!
            );
            
            // 更新全局状态和本地缓存
            settings.storyNodes = updatedNodesText;
            await saveSettings();
          }
        }).catch((error) => {
          console.error('更新故事节点失败:', error);
        });
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

  // 🌟 企业级：生成单章精美卡片
  const handleExportImage = async () => {
    if (!chapters || chapters.length === 0) return;
    setShowExportSheet(false);
    Taro.showLoading({ title: '正在绘制卡片...', mask: true });

    // 🌟 尝试获取微信用户昵称（静默获取，若无权限则用默认值）
    let userName = '微信创作者';
    try {
      const userInfoRes = await Taro.getUserInfo();
      if (userInfoRes?.userInfo?.nickName) {
        userName = userInfoRes.userInfo.nickName;
      }
    } catch (e) {
      console.log('未授权获取用户昵称，使用默认值');
    }

    try {
      // 1. 获取 Canvas 2D 对象
      const query = Taro.createSelectorQuery();
      query.select('#poster-canvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          const canvas = res[0]?.node;
          if (!canvas) {
            Taro.hideLoading();
            Taro.showToast({ title: '画布初始化失败', icon: 'error' });
            return;
          }

          const ctx = canvas.getContext('2d');

          // 🌟 核心修复 1：强制解绑屏幕 dpr (设备像素比)
          // 手机屏幕 dpr 很高，如果强行放大画布尺寸，极易撑爆 iOS 4096px 的硬件极限导致下方全黑。
          // 导出图片直接使用 1:1 绘制，750px 的标准海报宽度已经足够清晰。
          const exportDpr = 1; 

          // 🌟 修复点 1：我们将安全高度放宽到 8000（因为 dpr 是 1，8000 完全不会内存溢出）
          const MAX_CANVAS_HEIGHT = 8000;

          const canvasWidth = 750;
          const padding = 60;
          const contentWidth = canvasWidth - padding * 2;
          
          let currentY = padding;

          // --- 1. 预计算高度 ---
          // 标题计算
          ctx.font = 'bold 50px sans-serif';
          // 如果没有名字，给个兜底
          const titleText = currentStoryTitle || 'AIBook 互动小说';
          currentY += measureTextHeight(ctx, titleText, contentWidth, 65);
          
          // 日期与标签计算
          currentY += 40; 
          ctx.font = '28px sans-serif';
          currentY += 30; 
          currentY += 50; 

          // 第一章内容计算（截断 300 字）
          const firstCh = chapters[0];
          let cleanContent = filterAIMetaText(firstCh?.content || '');
          if (cleanContent.length > 300) {
            cleanContent = cleanContent.slice(0, 300) + '......（未完待续）';
          }
          ctx.font = '30px sans-serif';
          currentY += measureTextHeight(ctx, cleanContent, contentWidth, 50);

          // 底部区域计算
          currentY += 80; // 留白
          currentY += 30; // THE END
          currentY += 40; // 留白
          currentY += 30; // 微信名 + AIBook
          currentY += 20; // 留白
          currentY += 24; // 下载 App 提示
          currentY += 60; // 底部最终留白
          const totalHeight = Math.min(currentY, MAX_CANVAS_HEIGHT); 

          canvas.width = canvasWidth * exportDpr;
          canvas.height = totalHeight * exportDpr;
          ctx.scale(exportDpr, exportDpr);

          // --- 2. 正式绘制卡片 ---
          // 画卡片背景
          ctx.fillStyle = '#FDFDFD'; 
          ctx.fillRect(0, 0, canvasWidth, totalHeight); 
          
          // 顶部高级感装饰条
          ctx.fillStyle = '#0052D9'; 
          ctx.fillRect(0, 0, canvasWidth, 16); 

          let drawY = padding + 20;
          ctx.textAlign = 'left'; // 确保文字靠左

          // 画大标题
          ctx.fillStyle = '#111111';
          ctx.font = 'bold 50px sans-serif';
          drawY = drawWrappedText(ctx, titleText, padding, drawY + 40, contentWidth, 65);

          // 画日期标签
          drawY += 40;
          ctx.fillStyle = '#888888';
          ctx.font = '28px sans-serif';
          const timestamp = new Date().toLocaleString('zh-CN');
          ctx.fillText(`${timestamp}  |  📝 AIBook 智能创作`, padding, drawY + 28);
          drawY += 50;

          // 画分割线
          ctx.strokeStyle = '#EEEEEE';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(padding, drawY);
          ctx.lineTo(canvasWidth - padding, drawY);
          ctx.stroke();
          drawY += 40;

          // 画第一章正文
          ctx.fillStyle = '#333333';
          ctx.font = '30px sans-serif';
          drawY = drawWrappedText(ctx, cleanContent, padding, drawY + 30, contentWidth, 50);
          
          // --- 3. 画底部品牌与引流区 ---
          drawY += 80;

          // THE END
          ctx.fillStyle = '#BBBBBB';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center'; // 改为居中绘制
          ctx.fillText('- 第一幕 -', canvasWidth / 2, drawY);
          drawY += 50;

          // 用户名 + 小程序名
          ctx.fillStyle = '#666666';
          ctx.font = '26px sans-serif';
          ctx.fillText(`创作者：${userName} · AIBook`, canvasWidth / 2, drawY);
          drawY += 35;

          // 引导下载
          ctx.fillStyle = '#999999';
          ctx.font = '22px sans-serif';
          ctx.fillText('体验更多内容请下载App', canvasWidth / 2, drawY);

          // 🌟 修复点 3（最关键）：给 GPU 留出 300 毫秒的刷新缓冲时间，避免底部没画完就被截掉
          setTimeout(() => {
            exportCanvasToAlbum(canvas, canvasWidth, totalHeight);
          }, 600);
        });
    } catch (error) {
      Taro.hideLoading();
      Taro.showToast({ title: '卡片生成失败', icon: 'error' });
    }
  }

  // 🌟 企业级：相册保存及权限兜底处理
  const exportCanvasToAlbum = (canvas: any, exportWidth: number, exportHeight: number) => {
    Taro.canvasToTempFilePath({
      canvas: canvas,
      x: 0,
      y: 0,
      width: exportWidth,
      height: exportHeight,
      destWidth: exportWidth,     // 🌟 核心修复 4：明确指定生成图片的尺寸，拒绝微信内部乱缩放
      destHeight: exportHeight,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        const tempFilePath = res.tempFilePath;
        Taro.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => {
            Taro.hideLoading();
            Taro.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: (err) => {
            Taro.hideLoading();
            if (err.errMsg.includes('auth deny') || err.errMsg.includes('fail auth deny')) {
              // 用户曾经拒绝过授权，引导去设置页开启
              Taro.showModal({
                title: '需要保存权限',
                content: '请在设置中开启「相册」权限，才能保存长图哦',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) Taro.openSetting();
                }
              });
            } else if (err.errMsg.includes('cancel')) {
              Taro.showToast({ title: '已取消保存', icon: 'none' });
            } else {
              Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
            }
          }
        });
      },
      fail: () => {
        Taro.hideLoading();
        Taro.showToast({ title: '画布导出失败', icon: 'error' });
      }
    });
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
            <Text> 温馨提示：您尚未进行AI模型配置，配置后即可享受完整的AI创作体验！</Text>
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
              {/* 👇 🌟 修改这一行：让以前生成的带着【】的旧记录也瞬间变干净 */}
              <Text className="chapter-content">{filterAIMetaText(ch?.content || '')}</Text>
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
          <Button className="action-btn primary" size="mini" onClick={() => { 
            triggerVibrate('medium'); 
            // 🌟 核心逻辑更正：
            // 检查当前页面栈，如果是从列表页跳过来的，则直接返回，避免堆叠
            const pages = Taro.getCurrentPages();
            if (pages.length > 1) {
              Taro.navigateBack();
            } else {
              // 如果是直接打开的故事页（无上级页面），则重定向到列表
              Taro.reLaunch({ url: '/pages/story-list/index' });
            }
          }}>📚 故事列表</Button>
        </View>
      </View>

      <View className={`export-sheet-mask ${showExportSheet ? 'show' : ''}`} onClick={() => setShowExportSheet(false)}></View>
      <View className={`export-sheet ${showExportSheet ? 'show' : ''}`}>
        <View className="sheet-header"><Text>选择导出方式</Text></View>
        <View className="sheet-body">
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); handleCopyText(); }}><Text className="item-text">📄 复制生成纯文本</Text></View>
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); exportAsFile('txt'); }}><Text className="item-text">📁 导出 TXT 文本文件</Text></View>
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); exportAsFile('md'); }}><Text className="item-text">📝 导出 Markdown 文件</Text></View>
          <View className="sheet-item" onClick={() => { triggerVibrate('light'); handleExportImage(); }}><Text className="item-text">🖼️ 生成卡片</Text></View>
          <View className="sheet-item disabled" onClick={() => { triggerVibrate('medium'); Taro.showToast({ title: '仅供App功能开放', icon: 'error' }) }}><Text className="item-text">📑 导出 PDF 文件</Text><Text className="tag-app">App专属</Text></View>
          <View className="sheet-item disabled" onClick={() => { triggerVibrate('medium'); Taro.showToast({ title: '仅供App功能开放', icon: 'error' }) }}><Text className="item-text">📚 导出 EPUB 电子书</Text><Text className="tag-app">App专属</Text></View>
        </View>
        <View className="sheet-footer" onClick={() => setShowExportSheet(false)}>取消</View>
      </View>

      {/* 👇 🌟 隐形 Canvas 画布，强行撑开 CSS 高度以匹配最长的小说长度 */}
      <Canvas 
        type="2d" 
        id="poster-canvas" 
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: '-9999px', 
          width: '750px', // 👈 与逻辑画布保持 750 的一致
          height: '8000px', // 👈 修复点 4：暴力突破 DOM 裁剪屏障，不再写 100px
          zIndex: -1 
        }} 
      />
      
    </View>
  )
}