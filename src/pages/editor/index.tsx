import { useState, useEffect } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { polishText, isPolishApiConfigured } from '@/services/polish'
import type { SettingDocKey } from '@/types'
import { MAX_SETTING_CHARS, MAX_MD_FILE_BYTES } from '@/constants/settings'
import './index.scss'

const KEYS: SettingDocKey[] = ['characters', 'worldview', 'scenes', 'mainPlot', 'storyNodes']

export default function EditorPage() {
  const router = useRouter()
  const { settings, setOne, save } = useSettings()
  const key = (router.params.key || 'characters') as SettingDocKey
  const title = decodeURIComponent(router.params.title || '设定')
  const [value, setValue] = useState(settings[key] || '')
  const [polishing, setPolishing] = useState(false)

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
      
      // 修复点：将意外断行的正则表达式和字符串恢复为单行格式
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n')
      
      if (content) {
        // 显示文件信息
        const sizeKB = (file.size / 1024).toFixed(1)
        const fileType = fileName.endsWith('.md') ? 'Markdown' : '文本'
        
        setValue(prevValue => {
          const newValue = prevValue ? prevValue + '\n\n' + content : content
          const truncated = newValue.length > MAX_SETTING_CHARS
          const finalValue = truncated ? newValue.slice(0, MAX_SETTING_CHARS) : newValue
          
          // 显示导入结果
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
    if (!isPolishApiConfigured()) {
      Taro.showToast({ title: '请先配置润色接口（API 预留）', icon: 'none' })
      return
    }
    setPolishing(true)
    try {
      const result = await polishText(trimmed)
      setValue(result)
      Taro.showToast({ title: '润色完成', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '润色失败', icon: 'none' })
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
      <Textarea
        className="textarea"
        placeholder="支持 Markdown，可作为 AI 生成的参考依据；也可粘贴或导入外部 MD（本区最多 1000 字）"
        value={value}
        maxlength={MAX_SETTING_CHARS}
        onInput={(e) => setValue(String(e.detail.value).slice(0, MAX_SETTING_CHARS))}
        autoHeight
      />
      <Button className="btn-save" onClick={handleSave}>保存</Button>
    </View>
  )
}