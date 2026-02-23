import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config'

// 新增计算函数
function calculateWordLimit(inputText: string): number {
  const baseLength = inputText.length;
  // 生成字数在 100 到 300 之间，最高不超过 500
  const targetLength = Math.max(100, Math.min(500, Math.floor(baseLength * 1.5)));
  // 如果原文本很长，强制封顶 500
  return targetLength > 500 ? 500 : targetLength;
}

/**
 * AI 润色接口。
 * 将用户输入的文字发送到后端，返回润色后的文本。
 * 使用用户配置的API密钥调用真实的AI服务。
 * 
 * 🌟 优化说明：
 * 1. 增加超时时间至120秒，给AI充分思考时间
 * 2. 精准错误处理，区分不同类型的错误
 * 3. 透传后端返回的具体错误信息
 */
export async function polishText(text: string, type: string, apiKey: string): Promise<string> {
  const baseURL = API_BASE_URL
  
  // 计算目标字数并构建带字数限制的提示词
  const targetWords = calculateWordLimit(text);
  const systemPrompt = `你是一个专业的小说润色助手。请帮我润色以下小说片段。
要求：
1. 保持原意，提升文笔。
2. 严格控制字数，智能化输出！本次润色的输出内容必须在 ${targetWords} 字左右，绝对不可超过 500 字！`;
  
  try {
    const res = await Taro.request({
      url: `${baseURL}/polish`,
      method: 'POST',
      data: { text, type, apiKey, systemPrompt },
      header: { 'Content-Type': 'application/json' },
      // 🌟 修复 1：强行把超时时间延长到 120 秒（2分钟），给 AI 充分的思考时间
      timeout: 120000 
    })

    // 🌟 修复 2：如果状态码不是 200，说明后端/大模型报错了
    if (res.statusCode !== 200) {
      // 尝试提取真实的报错原因（比如 DeepSeek 官方返回的繁忙提示）
      const errorMsg = (res.data as any)?.error || `服务器异常(状态码: ${res.statusCode})`
      throw new Error(errorMsg)
    }

    const data = res.data as { text?: string }
    return data.text || ''
    
  } catch (err: any) {
    // 🌟 修复 3：精准捕获网络断开或超时错误
    if (err.errMsg && err.errMsg.includes('timeout')) {
      throw new Error('AI 思考时间太长，请求超时了，请重试')
    }
    // 抛出具体的错误给页面显示
    throw new Error(err.message || '润色请求失败，请检查网络')
  }
}

/** 是否已配置真实后端（非占位 URL） */
export function isPolishApiConfigured(): boolean {
  return !API_BASE_URL.includes('your-api.com')
}
