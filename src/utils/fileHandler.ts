import Taro from '@tarojs/taro'
import { MAX_MD_FILE_BYTES, MAX_SETTING_CHARS } from '@/constants/settings'

/**
 * 文件处理工具类
 * 专门处理MD文档的导入、验证和处理
 */
export class FileHandler {
  /**
   * 验证文件格式
   */
  static validateFileType(fileName: string): boolean {
    const allowedExtensions = ['.md', '.txt']
    const lowerFileName = fileName.toLowerCase()
    return allowedExtensions.some(ext => lowerFileName.endsWith(ext))
  }

  /**
   * 验证文件大小
   */
  static validateFileSize(size: number): { valid: boolean; message?: string } {
    if (size > MAX_MD_FILE_BYTES) {
      return {
        valid: false,
        message: `文件大小不能超过 ${(MAX_MD_FILE_BYTES / 1024).toFixed(1)}KB`
      }
    }
    if (size === 0) {
      return {
        valid: false,
        message: '文件为空'
      }
    }
    return { valid: true }
  }

  /**
   * 读取文件内容
   */
  static async readFile(filePath: string): Promise<string> {
    const fs = Taro.getFileSystemManager()
    const result: any = await fs.readFile({
      filePath,
      encoding: 'utf-8'
    })
    return (result.data as string) || ''
  }

  /**
   * 处理文件内容，确保符合设定要求
   */
  static processContent(content: string, existingContent: string = ''): {
    content: string
    truncated: boolean
    charCount: number
  } {
    // 移除BOM标记
    let processedContent = content.replace(/^\uFEFF/, '')
    
    // 修复点：将断行的正则表达式恢复为正确的一行写法
    // 移除多余的空白行（将3个及以上的连续换行替换为2个换行，即保留一个空行）
    processedContent = processedContent.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    // 如果已有内容，添加分隔符
    if (existingContent) {
      processedContent = existingContent + '\n\n' + processedContent
    }
    
    // 检查字符限制
    const charCount = processedContent.length
    let truncated = false
    
    if (charCount > MAX_SETTING_CHARS) {
      processedContent = processedContent.slice(0, MAX_SETTING_CHARS)
      truncated = true
    }
    
    return {
      content: processedContent,
      truncated,
      charCount
    }
  }

  /**
   * 获取文件信息
   */
  static getFileInfo(fileName: string, fileSize: number): {
    name: string
    size: string
    type: string
  } {
    const sizeKB = (fileSize / 1024).toFixed(1)
    const fileType = fileName.toLowerCase().endsWith('.md') ? 'Markdown' : '文本'
    
    return {
      name: fileName,
      size: `${sizeKB}KB`,
      type: fileType
    }
  }

  /**
   * 统一的文件选择和处理流程
   */
  static async selectAndProcessFile(existingContent: string = ''): Promise<{
    success: boolean
    content?: string
    message?: string
    fileInfo?: { name: string; size: string; type: string }
  }> {
    try {
      // 选择文件
      const fileResult = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['md', 'txt']
      })

      const file = fileResult.tempFiles?.[0]
      if (!file) {
        return {
          success: false,
          message: '未选择文件'
        }
      }

      // 验证文件类型
      if (!this.validateFileType(file.name)) {
        return {
          success: false,
          message: '只支持 .md 和 .txt 格式的文件'
        }
      }

      // 验证文件大小
      const sizeValidation = this.validateFileSize(file.size)
      if (!sizeValidation.valid) {
        return {
          success: false,
          message: sizeValidation.message
        }
      }

      // 读取文件内容
      const content = await this.readFile(file.path)
      
      // 处理内容
      const processed = this.processContent(content, existingContent)
      
      // 获取文件信息
      const fileInfo = this.getFileInfo(file.name, file.size)

      return {
        success: true,
        content: processed.content,
        fileInfo,
        message: processed.truncated 
          ? `文件已导入，内容已截断至${MAX_SETTING_CHARS}字` 
          : '文件导入成功'
      }

    } catch (error: any) {
      if (error.errMsg?.includes('cancel')) {
        return {
          success: false,
          message: '用户取消操作'
        }
      }
      
      return {
        success: false,
        message: error.message || '文件处理失败'
      }
    }
  }
}

/**
 * 剪贴板处理工具
 */
export class ClipboardHandler {
  /**
   * 从剪贴板读取文本
   */
  static async readText(): Promise<{
    success: boolean
    text?: string
    message?: string
  }> {
    try {
      const result = await Taro.getClipboardData()
      const text = result?.data?.trim() ?? ''
      
      if (!text) {
        return {
          success: false,
          message: '剪贴板为空'
        }
      }

      return {
        success: true,
        text,
        message: '读取成功'
      }
    } catch (error) {
      return {
        success: false,
        message: '读取剪贴板失败'
      }
    }
  }

  /**
   * 处理剪贴板内容合并
   */
  static processClipboardContent(clipboardText: string, existingContent: string = ''): {
    content: string
    truncated: boolean
    charCount: number
  } {
    let processedContent = clipboardText
    
    // 如果已有内容，添加分隔符
    if (existingContent) {
      processedContent = existingContent + '\n\n' + processedContent
    }
    
    // 检查字符限制
    const charCount = processedContent.length
    let truncated = false
    
    if (charCount > MAX_SETTING_CHARS) {
      processedContent = processedContent.slice(0, MAX_SETTING_CHARS)
      truncated = true
    }
    
    return {
      content: processedContent,
      truncated,
      charCount
    }
  }
}