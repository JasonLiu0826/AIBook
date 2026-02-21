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

/** 后端 API 根地址。微信小程序请设为电脑局域网 IP，如 http://192.168.1.100:3000 */
const getApiBase = (): string =>
  (process.env.AIBOOK_API_BASE || 'https://your-api.com/aibook').replace(/\/$/, '')

export async function generateChapterStream(
  params: GenerateParams, 
  onUpdate: (partialData: { type: string; value: string }) => void
): Promise<GenerateResult> {
  const baseURL = getApiBase()

  return new Promise((resolve, reject) => {
    // 检查是否配置了真实后端（未配置时使用 mock）
    if (baseURL.includes('your-api.com')) {
      // 使用mock数据（模拟流式效果）
      setTimeout(() => {
        onUpdate({ type: 'title', value: '第一章 神秘的邀请函' })
      }, 500)
      setTimeout(() => {
        onUpdate({ type: 'content', value: '夜色如墨，雨丝斜织。林默站在老旧公寓的窗前，手中握着一封泛黄的信封。' })
      }, 1500)
      setTimeout(() => {
        onUpdate({ type: 'content', value: '信封上没有寄件人姓名，只有一行娟秀的小字："致命运的编织者"。' })
      }, 2500)
      setTimeout(() => {
        onUpdate({ type: 'branches', value: JSON.stringify(['跟随神秘人影的指引', '仔细研究信件', '联系老朋友']) })
      }, 3500)
      setTimeout(() => {
        resolve(getMockFirstChapter())
      }, 4500)
      return
    }

    try {
      // 发起支持 chunked 的请求
      const requestTask = Taro.request({
        url: `${baseURL}/generate/stream`,
        method: 'POST',
        data: params,
        header: { 
          'Content-Type': 'application/json',
          ...(params.userConfig.apiKey ? { 'Authorization': `Bearer ${params.userConfig.apiKey}` } : {})
        },
        enableChunked: true, // 核心：开启流式接收
        timeout: 60000, // 60秒最大限制
        success: (res) => {
          // 请求成功，可能已经收到完整数据或部分数据
          // 如果后端在最后返回完整结果，这里可以处理
          try {
            const data = res.data as GenerateResult
            if (data.title && data.content && Array.isArray(data.branches)) {
              resolve(data)
            }
          } catch (e) {
            // 如果不是完整结果，继续等待流数据
          }
        },
        fail: (err) => {
          reject(new Error(`请求失败: ${err.errMsg}`))
        }
      })

      // 监听流式数据块的到达
      requestTask.onChunkReceived((res) => {
        try {
          // 将 ArrayBuffer 转为字符串
          const arrayBuffer = res.data
          const uint8Array = new Uint8Array(arrayBuffer)
          let text = ''
          for (let i = 0; i < uint8Array.length; i++) {
            text += String.fromCharCode(uint8Array[i])
          }
          
          // 解析流数据（假设后端返回格式：data: {"type":"content","value":"..."}\n\n）
          if (text.includes('data:')) {
            const jsonDataMatch = text.match(/data:\s*({.*})\s*\n\n/)
            if (jsonDataMatch && jsonDataMatch[1]) {
              try {
                const parsed = JSON.parse(jsonDataMatch[1])
                onUpdate(parsed)
              } catch (e) {
                console.error('解析流数据JSON失败:', e)
              }
            }
          }
        } catch (error) {
          console.error('处理流数据失败:', error)
        }
      })

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