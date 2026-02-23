import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config'

/**
 * AI 润色接口。
 * 将用户输入的文字发送到后端，返回润色后的文本。
 * 使用用户配置的API密钥调用真实的AI服务。
 */
export function polishText(text: string, type: string, apiKey: string): Promise<string> {
  const baseURL = API_BASE_URL
  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${baseURL}/polish`,
      method: 'POST',
      data: { text, type, apiKey },
      header: { 'Content-Type': 'application/json' }
    })
      .then((res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`润色失败: ${res.statusCode}`))
          return
        }
        const data = res.data as { text?: string }
        if (typeof data?.text !== 'string') {
          reject(new Error('返回格式错误：需要 text 字符串'))
          return
        }
        resolve(data.text)
      })
      .catch(reject)
  })
}

/** 是否已配置真实后端（非占位 URL） */
export function isPolishApiConfigured(): boolean {
  const base = 'http://192.168.3.5:3000'
  return !base.includes('your-api.com')
}
