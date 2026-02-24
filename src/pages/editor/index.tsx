import { useState, useEffect } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { polishText } from '@/services/polish'
import { useUserConfig } from '@/store/userConfig'
import type { SettingDocKey } from '@/types'
// 🌟 1. 确保导入 SETTING_DOCS
import { SETTING_DOCS, MAX_SETTING_CHARS, MAX_MD_FILE_BYTES } from '@/constants/settings'
import './index.scss'

const KEYS: SettingDocKey[] = ['characters', 'worldview', 'scenes', 'mainPlot', 'storyNodes']

export default function EditorPage() {
  const router = useRouter()
  const { settings, setOne, save } = useSettings()
  const { config } = useUserConfig()
  const key = (router.params.key || 'characters') as SettingDocKey
  const title = decodeURIComponent(router.params.title || '设定')
  const [value, setValue] = useState(settings[key] || '')
  const [polishing, setPolishing] = useState(false)

  // 🌟 2. 动态获取当前设定项的专属 placeholder
  const currentDoc = SETTING_DOCS.find(doc => doc.key === key)
  const placeholderText = currentDoc?.placeholder || '请输入内容...'

  useEffect(() => {
    if (KEYS.includes(key)) {
      setValue(settings[key] || '')
    }
  }, [key, settings])

  const handleSave = async () => {
    setOne(key, value)
    await save()
    Taro.showToast({ title: '已保存', icon: 'success' })
  }

  const handlePasteFromClipboard = async () => {
    try {
      const res = await Taro.getClipboardData()
      const text = res?.data ?? ''
      if (!text) {
        Taro.showToast({ title: '剪贴板为空', icon: 'none' })
        return
      }
      const next = value ? value + '\n\n' + text : text
      if (next.length > MAX_SETTING_CHARS) {
        setValue(next.slice(0, MAX_SETTING_CHARS))
        Taro.showToast({ title: `已达 ${MAX_SETTING_CHARS} 字上限`, icon: 'none' })
      } else {
        setValue(next)
        Taro.showToast({ title: '已粘贴', icon: 'success' })
      }
    } catch {
      Taro.showToast({ title: '读取剪贴板失败', icon: 'none' })
    }
  }

  const handleChooseFile = async () => {
    try {
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['md', 'txt']
      })

      const file = res.tempFiles?.[0]
      if (!file) {
        Taro.showToast({ title: '未选择文件', icon: 'none' })
        return
      }

      // 验证文件类型
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith('.md') && !fileName.endsWith('.txt')) {
        Taro.showToast({ title: '只支持 .md 和 .txt 格式的文件', icon: 'none' })
        return
      }

      // 验证文件大小
      if (file.size > MAX_MD_FILE_BYTES) {
        Taro.showToast({ 
          title: `文件大小不能超过 ${(MAX_MD_FILE_BYTES / 1024).toFixed(1)}KB`, 
          icon: 'none' 
        })
        return
      }

      if (file.size === 0) {
        Taro.showToast({ title: '文件为空', icon: 'none' })
        return
      }

      // 读取文件内容
      const fs = Taro.getFileSystemManager()
      const readFileResult: any = await fs.readFile({
        filePath: file.path,
        encoding: 'utf-8'
      })

      let content = (readFileResult.data as string) || ''
      
      // 移除BOM标记
      content = content.replace(/^\uFEFF/, '')
      // 将多个连续空行（含空白）合并为单个换行
      content = content.replace(/\n\s*\n\s*/g, '\n')
      
      if (content) {
        const sizeKB = (file.size / 1024).toFixed(1)
        const fileType = fileName.endsWith('.md') ? 'Markdown' : '文本'
        
        setValue(prevValue => {
          const newValue = prevValue ? prevValue + '\n\n' + content : content
          const truncated = newValue.length > MAX_SETTING_CHARS
          const finalValue = truncated ? newValue.slice(0, MAX_SETTING_CHARS) : newValue
          
          setTimeout(() => {
            Taro.showToast({ 
              title: truncated 
                ? `已导入${fileType}文件 (${sizeKB}KB)，内容已截断` 
                : `已导入${fileType}文件 (${sizeKB}KB)`, 
              icon: 'success',
              duration: 2000
            })
          }, 100)
          
          return finalValue
        })
      } else {
        Taro.showToast({ title: '文件内容为空', icon: 'none' })
      }
    } catch (err: any) {
      if (err.errMsg?.includes('cancel')) return
      console.error('文件处理错误:', err)
      Taro.showToast({ title: '文件处理失败: ' + (err.message || '未知错误'), icon: 'none' })
    }
  }

  const handlePolish = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      Taro.showToast({ title: '请先输入要润色的内容', icon: 'none' })
      return
    }
    
    // 检查API配置
    if (!config.apiKey?.trim()) {
      Taro.showToast({ 
        title: '请先在"AI模型配置"中填写API密钥', 
        icon: 'none' 
      })
      return
    }
    
    setPolishing(true)
    try {
      Taro.showLoading({ title: 'AI正在精雕细琢...' })
      // 把 key 传给后端，这样就能根据不同的设定类型（比如 characters）使用专属的润色 Prompt
      const result = await polishText(trimmed, key, config.apiKey)
      setValue(result)
      Taro.hideLoading()
      Taro.showToast({ title: '润色完成', icon: 'success' })
    } catch (e) {
      Taro.hideLoading()
      Taro.showToast({ 
        title: e instanceof Error ? e.message : '润色请求失败', 
        icon: 'none' 
      })
    } finally {
      setPolishing(false)
    }
  }

  return (
    <View className="page-editor">
      <View className="label">
        <Text>{title}</Text>
      </View>
      <View className="toolbar">
        <Button plain className="toolbar-btn" size="mini" onClick={handlePasteFromClipboard}>
          从剪贴板导入
        </Button>
        <Button plain className="toolbar-btn" size="mini" onClick={handleChooseFile}>
          选择 MD/TXT 文件
        </Button>
        <Button plain className="toolbar-btn polish" size="mini" onClick={handlePolish} disabled={polishing}>
          {polishing ? '润色中…' : 'AI 润色'}
        </Button>
      </View>
      
      {/* 🌟 3. 使用动态读取的 placeholderText */}
      <Textarea
        className="textarea"
        placeholder={placeholderText}
        value={value}
        maxlength={MAX_SETTING_CHARS}
        onInput={(e) => setValue(String(e.detail.value).slice(0, MAX_SETTING_CHARS))}
        autoHeight
      />

      {/* 🌟 4. 新增的固定提示区域 */}
      <View className="hint-text">
        <Text>💡 支持 Markdown，可作为 AI 生成的参考依据；也可粘贴或导入外部 MD（本区最多 {MAX_SETTING_CHARS} 字）</Text>
      </View>

      <Button className="btn-save" onClick={handleSave}>保存</Button>
    </View>
  )
}