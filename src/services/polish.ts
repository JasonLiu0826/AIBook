import Taro from '@tarojs/taro'

/**
 * AI 润色接口（预留）。
 * 将用户输入的文字发送到后端，返回润色后的文本。
 * 后端需实现 POST {baseURL}/polish，Body: { text: string }，响应: { text: string }。
 */
export function polishText(text: string): Promise<string> {
  const baseURL = 'http://192.168.3.5:3000'
  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${baseURL}/polish`,
      method: 'POST',
      data: { text },
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
