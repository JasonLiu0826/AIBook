import Taro from '@tarojs/taro'
import type { GenerateParams, GenerateResult } from '@/types'

/**
 * AI 生成接口 - 普通版本（返回完整结果）
 * 对于不需要实时更新UI的场景使用
 */
export async function generateChapter(params: GenerateParams): Promise<GenerateResult> {
  // 收集流式数据
  let title = ''
  let content = ''
  let branches: string[] = []
  
  return new Promise((resolve, reject) => {
    generateChapterStream(params, (partialData) => {
      switch (partialData.type) {
        case 'title':
          title = partialData.value
          break
        case 'content':
          content += partialData.value
          break
        case 'branches':
          try {
            branches = JSON.parse(partialData.value)
          } catch (e) {
            console.error('解析分支数据失败:', e)
          }
          break
      }
    }).then((result) => {
      // 返回最终结果
      resolve({
        title: result.title || title,
        content: result.content || content,
        branches: result.branches || branches
      })
    }).catch(reject)
  })
}

/**
 * AI 生成接口 - 流式传输版本（微信小程序兼容）
 * 使用 enableChunked + onChunkReceived 实现真正的流式响应
 * 后端需支持分块传输（chunked transfer encoding）
 */

/** 后端 API 根地址。本地开发环境使用 192.168.3.5 */
const getApiBase = (): string => 'http://192.168.3.5:3000'

export async function generateChapterStream(
  params: GenerateParams, 
  onUpdate: (partialData: { type: string; value: string }) => void
): Promise<GenerateResult> {
  const baseURL = getApiBase()

  return new Promise((resolve, reject) => {
    // 检查是否配置了真实后端（未配置时使用 mock）
    if (baseURL.includes('your-api.com')) {
      setTimeout(() => onUpdate({ type: 'title', value: '第一章 神秘的邀请函' }), 500)
      setTimeout(() => onUpdate({ type: 'content', value: '夜色如墨，雨丝斜织。林默站在老旧公寓的窗前，手中握着一封泛黄的信封。' }), 1500)
      setTimeout(() => onUpdate({ type: 'content', value: '信封上没有寄件人姓名，只有一行娟秀的小字："致命运的编织者"。' }), 2500)
      setTimeout(() => onUpdate({ type: 'branches', value: JSON.stringify(['跟随神秘人影的指引', '仔细研究信件', '联系老朋友']) }), 3500)
      setTimeout(() => resolve(getMockFirstChapter()), 4500)
      return
    }

    // 🌟【修复点1】在这里内部收集最终结果，等待请求结束时统一返回
    let finalTitle = ''
    let finalContent = ''
    let finalBranches: [string, string, string] = ['', '', '']

    try {
      const requestTask = Taro.request({
        url: `${baseURL}/generate/stream`,
        method: 'POST',
        data: params,
        header: { 
          'Content-Type': 'application/json',
          ...(params.userConfig.apiKey ? { 'Authorization': `Bearer ${params.userConfig.apiKey}` } : {})
        },
        enableChunked: true, 
        timeout: 60000, 
        success: () => {
          // 🌟【修复点2】网络连接正常结束时，直接 resolve 我们在 onChunkReceived 中拼装好的数据
          resolve({
            title: finalTitle,
            content: finalContent,
            branches: finalBranches
          })
        },
        fail: (err) => {
          reject(new Error(`请求失败: ${err.errMsg}`))
        }
      })

      // 👇 核心修复区开始 👇
      let streamBuffer = '' // 【修复】在回调外部声明缓冲区，防止多次触发时清空之前的数据
      
      // 【修复】使用 TextDecoder 处理 UTF-8，彻底解决中文乱码 (需微信基础库支持)
      // 如果小程序报错找不到 TextDecoder，可使用 TextDecoder polyfill
      const decoder = new TextDecoder('utf-8')

      requestTask.onChunkReceived((res) => {
        try {
          // 1. 解码新到达的数据块，并拼接到缓冲区末尾
          const chunkText = decoder.decode(new Uint8Array(res.data), { stream: true })
          streamBuffer += chunkText
          
          // 2. 按 SSE 协议的事件分隔符 \n\n 拆分数据包
          const parts = streamBuffer.split('\n\n')
          
          // 3. 最后一个元素可能是未接收完整的半个包，弹出并保留在缓冲区中等待下次拼接
          streamBuffer = parts.pop() || ''
          
          // 4. 遍历处理所有完整的包
          for (const part of parts) {
            const trimmedPart = part.trim()
            if (!trimmedPart) continue
            
            // 确保是 data: 开头的数据
            if (trimmedPart.startsWith('data:')) {
              const jsonStr = trimmedPart.replace(/^data:\s*/, '').trim()
              
              if (jsonStr === '[DONE]') continue // 忽略某些AI接口规范的结束符
              
              try {
                const parsed = JSON.parse(jsonStr)
                // 🌟【修复点3】在此处拼装最终结果
                if (parsed.type === 'title') finalTitle = parsed.value
                if (parsed.type === 'content') finalContent += parsed.value
                if (parsed.type === 'branches') {
                  try { 
                    const branchesArray = JSON.parse(parsed.value);
                    // 确保数组长度为3，不足的用空字符串填充
                    finalBranches = [
                      branchesArray[0] || '',
                      branchesArray[1] || '',
                      branchesArray[2] || ''
                    ] as [string, string, string];
                  } catch (e) {}
                }
                onUpdate(parsed)
              } catch (e) {
                console.error('单条流数据JSON解析失败:', jsonStr, e)
              }
            }
          }
        } catch (error) {
          console.error('处理流数据块失败:', error)
        }
      })
      // 👆 核心修复区结束 👆

    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 是否已配置真实后端（非占位 URL）
 */
export function isGenerateApiConfigured(aiProvider: string, apiKey?: string): boolean {
  const hasApiKey = aiProvider !== 'mock' && aiProvider !== 'custom' && !!apiKey?.trim()
  // 已配置本地后端地址，只要有有效的API密钥就认为已配置
  return hasApiKey || aiProvider === 'custom'
}

/**
 * 获取模拟的第一章数据（用于演示模式）
 */
export function getMockFirstChapter(): GenerateResult {
  return {
    title: '第一章 神秘的邀请函',
    content: `夜色如墨，雨丝斜织。林默站在老旧公寓的窗前，手中握着一封泛黄的信封。信封上没有寄件人姓名，只有一行娟秀的小字："致命运的编织者"。

他轻轻拆开信封，一张羊皮纸滑落而出。纸张边缘已经磨损，上面用暗红色墨水写着一段话：

"当月光与影子重叠之时，古老的图书馆将向你敞开大门。那里藏着改变一切的秘密，但记住——选择即代价。"

林默的心跳突然加快。这封信，和三年前父亲失踪前留下的最后一句话一模一样。

窗外，一道闪电划破夜空，照亮了对面大楼玻璃幕墙上的倒影——那里，似乎有一个模糊的人影正注视着他。`,
    branches: [
      '跟随神秘人影的指引，前往对面大楼',
      '仔细研究信件，寻找隐藏的线索',
      '联系老朋友，询问关于父亲失踪的往事'
    ]
  }
}