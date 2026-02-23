import Taro from '@tarojs/taro'
import type { GenerateParams, GenerateResult, Chapter } from '@/types'

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

/** 后端 API 根地址。本地开发环境使用 192.168.3.5 */
const getApiBase = (): string => 'http://192.168.3.5:3000'

export async function generateChapterStream(
  params: GenerateParams, 
  onUpdate: (partialData: { type: string; value: string }) => void
): Promise<GenerateResult> {
  const baseURL = getApiBase()

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
                    finalBranches = [
                      branchesArray[0] || '',
                      branchesArray[1] || '',
                      branchesArray[2] || ''
                    ] as [string, string, string];
                  } catch (e) {}
                }
                // ✅ 处理node_update类型的解析
                if (parsed.type === 'node_update' && parsed.value) {
                    // 触发更新回调，让 UI 层感知到有了新的"锚点"
                    onUpdate({ type: 'node_update', value: parsed.value });
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

// ✅ 增加润色函数
export async function polishSetting(text: string, type: 'worldview' | 'character', apiKey: string): Promise<string> {
  const response = await Taro.request({
    url: `${getApiBase()}/polish`,
    method: 'POST',
    data: { text, type, apiKey }
  });
  if (response.statusCode !== 200) throw new Error(response.data.error || '润色失败');
  return response.data.text;
}

export function getMockFirstChapter(): GenerateResult {
  return {
    title: '第一章 神秘的邀请函',
    content: `夜色如墨，雨丝斜织。林默站在老旧公寓的窗前，手中握着一封泛黄的信封。`,
    branches: ['跟随', '研究', '联系']
  }
}