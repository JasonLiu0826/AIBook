import Taro from '@tarojs/taro'
import type { GenerateParams, GenerateResult, Chapter } from '@/types'
import { API_BASE_URL } from '@/config'
import { MAX_SETTING_CHARS } from '@/constants/settings' // 确保引入了字数上限常量

// 👇 把这段代码粘贴在这里，这是一个所有手机都兼容的万能解码器
class Utf8Decoder {
  private buffer: number[] = [];

  public decode(bytes: Uint8Array): string {
    let i = 0;
    let str = "";
    const allBytes = new Uint8Array(this.buffer.length + bytes.length);
    allBytes.set(this.buffer);
    allBytes.set(bytes, this.buffer.length);
    this.buffer = [];
    
    while (i < allBytes.length) {
      const c = allBytes[i];
      let bytesNeeded = 0;
      
      if (c <= 0x7F) bytesNeeded = 1;
      else if ((c & 0xE0) === 0xC0) bytesNeeded = 2;
      else if ((c & 0xF0) === 0xE0) bytesNeeded = 3;
      else if ((c & 0xF8) === 0xF0) bytesNeeded = 4;
      else { i++; continue; } 
      
      if (i + bytesNeeded > allBytes.length) {
        for (let j = i; j < allBytes.length; j++) {
          this.buffer.push(allBytes[j]);
        }
        break;
      }
      
      if (bytesNeeded === 1) {
        str += String.fromCharCode(c);
      } else if (bytesNeeded === 2) {
        str += String.fromCharCode(((c & 0x1F) << 6) | (allBytes[i + 1] & 0x3F));
      } else if (bytesNeeded === 3) {
        str += String.fromCharCode(((c & 0x0F) << 12) | ((allBytes[i + 1] & 0x3F) << 6) | (allBytes[i + 2] & 0x3F));
      } else if (bytesNeeded === 4) {
        const codePoint = ((c & 0x07) << 18) | ((allBytes[i + 1] & 0x3F) << 12) | ((allBytes[i + 2] & 0x3F) << 6) | (allBytes[i + 3] & 0x3F);
        const u = codePoint - 0x10000;
        str += String.fromCharCode(0xD800 | (u >> 10));
        str += String.fromCharCode(0xDC00 | (u & 0x3FF));
      }
      i += bytesNeeded;
    }
    return str;
  }
}

/**
 * AI 生成接口 - 普通版本（返回完整结果）
 */
export async function generateChapter(params: GenerateParams): Promise<GenerateResult> {
  let title = ''
  let content = ''
  let branches: string[] = []
  
  return new Promise((resolve, reject) => {
    generateChapterStream(params, (partialData) => {
      switch (partialData.type) {
        case 'title': title = partialData.value; break;
        case 'content': content += partialData.value; break;
        case 'branches':
          try { branches = JSON.parse(partialData.value) } catch (e) { }
          break;
      }
    }).then((result) => {
      resolve({
        title: result.title || title,
        content: result.content || content,
        branches: result.branches || branches
      })
    }).catch(reject)
  })
}

/** 后端 API 根地址。读取全局配置 */
const getApiBase = (): string => API_BASE_URL

export async function generateChapterStream(
  params: GenerateParams, 
  onUpdate: (partialData: { type: string; value: string }) => void
): Promise<GenerateResult> {
  // 🌟 修改点：判断如果用户选择了 custom 并且填写了自定义地址，则优先使用该自定义地址
  let baseURL = getApiBase()
  if (params.userConfig.aiProvider === 'custom' && params.userConfig.customApiUrl) {
    baseURL = params.userConfig.customApiUrl.replace(/\/$/, ''); // 去除末尾可能存在的斜杠
  }

  return new Promise((resolve, reject) => {
    if (baseURL.includes('your-api.com')) {
      setTimeout(() => onUpdate({ type: 'title', value: '第一章 神秘的邀请函' }), 500)
      setTimeout(() => onUpdate({ type: 'content', value: '夜色如墨，雨丝斜织。林默站在老旧公寓的窗前，手中握着一封泛黄的信封。' }), 1500)
      setTimeout(() => resolve(getMockFirstChapter()), 4500)
      return
    }

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
          resolve({
            title: finalTitle,
            content: finalContent,
            branches: finalBranches
          })
        },
        fail: (err) => {
          reject(new Error(`网络请求失败，请确保电脑和手机在同一WiFi且关闭VPN: ${err.errMsg}`))
        }
      })

      let streamBuffer = '' 
      const decoder = new Utf8Decoder()

      requestTask.onChunkReceived((res) => {
        try {
          let chunkText = ''
          
          // 🌟 终极修复点 1：判断微信底层是返还了字符串还是字节流！
          if (typeof res.data === 'string') {
            chunkText = res.data
          } else {
            chunkText = decoder.decode(new Uint8Array(res.data))
          }
          
          streamBuffer += chunkText
          
          const parts = streamBuffer.split('\n\n')
          streamBuffer = parts.pop() || ''
          
          for (const part of parts) {
            const trimmedPart = part.trim()
            if (!trimmedPart) continue
            
            if (trimmedPart.startsWith('data:')) {
              const jsonStr = trimmedPart.replace(/^data:\s*/, '').trim()
              if (jsonStr === '[DONE]') continue 
              
              try {
                const parsed = JSON.parse(jsonStr)
                
                // 🌟 终极修复点 2：如果是后端传来的 Error（如没填 API Key），直接抛出明确的错误！
                if (parsed.type === 'error') {
                  reject(new Error(parsed.value))
                  return
                }

                if (parsed.type === 'title') finalTitle = parsed.value
                if (parsed.type === 'content') finalContent += parsed.value
                if (parsed.type === 'branches') {
                  try { 
                    const branchesArray = JSON.parse(parsed.value);
                    console.log('🤖 AI服务接收到分支数据:', branchesArray);
                    finalBranches = [
                      branchesArray[0] || '',
                      branchesArray[1] || '',
                      branchesArray[2] || ''
                    ] as [string, string, string];
                    console.log('🤖 AI服务处理后的分支数据:', finalBranches);
                  } catch (e) {
                    console.error('🤖 AI服务分支数据解析失败:', parsed.value, e);
                  }
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

    } catch (error) {
      reject(error)
    }
  })
}

export function isGenerateApiConfigured(aiProvider: string, apiKey?: string): boolean {
  const hasApiKey = aiProvider !== 'mock' && aiProvider !== 'custom' && !!apiKey?.trim()
  return hasApiKey || aiProvider === 'custom'
}

export function getMockFirstChapter(): GenerateResult {
  return {
    title: '第一章 神秘的邀请函',
    content: `夜色如墨，雨丝斜织。林默站在老旧公寓的窗前，手中握着一封泛黄的信封。`,
    branches: ['跟随', '研究', '联系']
  }
}

/**
 * 智能化关键节点提炼
 * @param chapterTitle 章节标题
 * @param chapterContent 章节内容
 * @param apiKey 用户API密钥
 * @returns 提取的关键节点文本
 */
export async function summarizeChapterNode(
  chapterTitle: string, 
  chapterContent: string, 
  apiKey: string,
  customApiUrl?: string
): Promise<string> {
  // 🌟 添加自定义API地址支持
  let baseURL = getApiBase()
  if (customApiUrl) {
    baseURL = customApiUrl.replace(/\/$/, ''); // 去除末尾可能存在的斜杠
  }
  
  if (baseURL.includes('your-api.com')) {
    // 模拟模式下返回空字符串（不记录节点）
    return ''
  }

  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${baseURL}/summarize-node`,
      method: 'POST',
      data: { chapterTitle, chapterContent, apiKey },
      header: { 'Content-Type': 'application/json' }
    })
      .then((res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`节点提炼失败: ${res.statusCode}`))
          return
        }
        const data = res.data as { summary?: string }
        if (typeof data?.summary !== 'string') {
          reject(new Error('返回格式错误：需要 summary 字符串'))
          return
        }
        resolve(data.summary)
      })
      .catch(reject)
  })
}

/**
 * 智能追加并处理故事节点压缩
 * @param currentNodes 当前已存储的所有节点文本
 * @param newNode 新生成的这一章的节点
 * @param apiKey 用户配置的 API Key
 */
export async function smartAppendStoryNode(
  currentNodes: string,
  newNode: string,
  apiKey: string
): Promise<string> {
  // 🌟 改进 3：安全拦截
  if (!newNode || !newNode.trim()) return currentNodes;
  if (!apiKey) throw new Error('进行节点压缩需要配置有效的 API Key');

  // 1. 拼接新节点
  let text = currentNodes?.trim() || ''
  text = text ? `${text}\n${newNode}` : newNode

  // 2. 按行分割并过滤空行
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // 3. 保持原有的安全分类策略（保护用户手动输入的非标准格式文本不丢失）
  const summaryLines = lines.filter(l => l.startsWith('【阶段总结】') || l.startsWith('【全局总结】'))
  const normalLines = lines.filter(l => !l.startsWith('【阶段总结】') && !l.startsWith('【全局总结】'))

  // 4. 🌟 改进 2：优先触发阶段压缩 (满100条普通节点)
  if (normalLines.length >= 100) {
    console.log('触发百条节点阶段压缩')
    const textToCompress = normalLines.join('\n')
    // 🌟 传递自定义API地址参数
    const phaseSummary = await compressStoryNodes(textToCompress, 'phase', apiKey, '')
    
    const textAfterPhaseCompress = [...summaryLines, `【阶段总结】${phaseSummary}`].join('\n')
    
    // 阶段压缩完成后，如果因为历史总结堆积太多导致总字数依然超标，则执行终极全局压缩
    if (textAfterPhaseCompress.length >= MAX_SETTING_CHARS * 0.9) {
      console.log('阶段压缩后字数仍逼近上限，触发终极全局压缩')
      // 🌟 传递自定义API地址参数
      const globalSummary = await compressStoryNodes(textAfterPhaseCompress, 'global', apiKey, '')
      return `【全局总结】${globalSummary}`
    }
    
    return textAfterPhaseCompress
  }

  // 5. 如果节点没到 100 条，但用户手动贴了长篇大论导致字数超标，直接全局压缩
  if (text.length >= MAX_SETTING_CHARS * 0.9) {
    console.log('字数逼近上限，触发全局节点压缩')
    // 🌟 传递自定义API地址参数
    const compressed = await compressStoryNodes(text, 'global', apiKey, '')
    return `【全局总结】${compressed}`
  }

  // 6. 没有触发任何压缩条件，返回正常追加的文本
  return text
}

/**
 * 压缩故事节点
 * @param content 需要压缩的节点内容
 * @param mode 'phase' 阶段压缩(50-100字) | 'global' 全局压缩(100-200字)
 * @param apiKey 用户API密钥
 */
export async function compressStoryNodes(
  content: string,
  mode: 'phase' | 'global',
  apiKey: string,
  customApiUrl?: string
): Promise<string> {
  // 🌟 添加自定义API地址支持
  let baseURL = getApiBase()
  if (customApiUrl) {
    baseURL = customApiUrl.replace(/\/$/, ''); // 去除末尾可能存在的斜杠
  }
  
  if (baseURL.includes('your-api.com')) {
    return mode === 'phase' 
      ? '【系统生成】林默在调查旧公寓时发现了隐藏的线索，并与神秘人建立了初步联系，故事进入暗线调查阶段。' 
      : '【系统生成】林默从公寓收信开始，历经神秘组织的试探与多次危机，现已掌握核心关键道具，即将开启最终决战。'
  }

  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${baseURL}/compress-nodes`, // 👉 后端需要新增这个接口
      method: 'POST',
      data: { content, mode, apiKey },
      header: { 'Content-Type': 'application/json' }
    })
      .then((res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`节点压缩失败: ${res.statusCode}`))
          return
        }
        const data = res.data as { summary?: string }
        if (typeof data?.summary !== 'string') {
          reject(new Error('返回格式错误：需要 summary 字符串'))
          return
        }
        resolve(data.summary)
      })
      .catch(reject)
  })
}