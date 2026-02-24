import { useState, useEffect } from 'react'
import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useSettings } from '@/store/settings'
import { polishText } from '@/services/polish'
import { useUserConfig } from '@/store/userConfig'
import type { SettingDocKey } from '@/types'
import { SETTING_DOCS, MAX_SETTING_CHARS, MAX_MD_FILE_BYTES } from '@/constants/settings'
import './index.scss'

const KEYS: SettingDocKey[] = ['characters', 'worldview', 'scenes', 'mainPlot', 'storyNodes']

export default function EditorPage() {
  const router = useRouter()
  // 🌟 解构出我们刚刚写的附件方法
  const { settings, setOne, attachedFiles, setAttachedFile, save } = useSettings()
  const { config } = useUserConfig()
  
  const key = (router.params.key || 'characters') as SettingDocKey
  const title = decodeURIComponent(router.params.title || '设定')
  const [value, setValue] = useState(settings[key] || '')
  const [polishing, setPolishing] = useState(false)
  
  // 🌟 全屏预览的状态控制
  const [previewing, setPreviewing] = useState(false)

  const attachedFile = attachedFiles?.[key]
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

  // 🌟 修复后的附件导入逻辑
  const handleChooseFile = async () => {
    try {
      if (attachedFile) {
        return Taro.showToast({ title: '每个设定只允许附加1个文档，请先删除现有文档', icon: 'none' })
      }

      const res = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['md', 'txt'] })
      const file = res.tempFiles?.[0]
      if (!file) return

      // 增加安全回退，防止某些机型取不到文件名
      const fileName = (file.name || '未命名').toLowerCase()
      if (!fileName.endsWith('.md') && !fileName.endsWith('.txt')) {
        return Taro.showToast({ title: '只支持 .md 和 .txt 格式', icon: 'none' })
      }

      if (file.size > MAX_MD_FILE_BYTES) {
        return Taro.showToast({ title: `文件不能超过 ${(MAX_MD_FILE_BYTES / 1024).toFixed(0)}KB`, icon: 'none' })
      }
      if (file.size === 0) return Taro.showToast({ title: '文件为空', icon: 'none' })

      Taro.showLoading({ title: '正在解析文件...' })

      // 🌟 核心修复点：将微信原生的回调函数手动包装成 Promise，强制程序等待文件读取完毕
      const fileContent = await new Promise<string>((resolve, reject) => {
        const fs = Taro.getFileSystemManager()
        fs.readFile({
          filePath: file.path,
          encoding: 'utf-8',
          success: (readRes) => resolve((readRes.data as string) || ''),
          fail: (err) => reject(new Error(err.errMsg || '底层文件读取失败'))
        })
      })

      // 文本清理：移除隐藏的BOM字符，清理多余的连行
      let content = fileContent.replace(/^\uFEFF/, '').replace(/\n\s*\n\s*/g, '\n')
      
      Taro.hideLoading()

      if (content) {
        setAttachedFile(key, { name: file.name, content: content, size: file.size })
        await save() // 立即保存到本地缓存
        Taro.showToast({ title: '附件导入成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '文件解析后内容为空', icon: 'none' })
      }
      
    } catch (err: any) {
      Taro.hideLoading()
      // 如果用户主动取消选择，不做任何提示
      if (err?.errMsg?.includes('cancel')) return 
      
      console.error('文件处理报错详细信息：', err)
      
      // 🌟 增强错误提示，把真正的错误原因弹出来，而不是统称失败
      const errorMsg = err?.message || err?.errMsg || '未知错误'
      Taro.showToast({ 
        title: `导入失败: ${errorMsg}`, 
        icon: 'none', 
        duration: 3000 
      })
    }
  }

  // 🌟 删除附件逻辑
  const handleRemoveFile = async () => {
    Taro.showModal({
      title: '移除文档',
      content: '确定要移除这个附加文档吗？',
      confirmColor: '#ff6b6b',
      success: async (res) => {
        if (res.confirm) {
          setAttachedFile(key, null)
          await save()
          Taro.showToast({ title: '已移除', icon: 'success' })
        }
      }
    })
  }

  const handlePolish = async () => {
    const trimmed = value.trim()
    if (!trimmed) return Taro.showToast({ title: '请先在输入框填写内容', icon: 'none' })
    if (!config.apiKey?.trim()) return Taro.showToast({ title: '请先配置API密钥', icon: 'none' })
    
    setPolishing(true)
    try {
      Taro.showLoading({ title: 'AI正在精雕细琢...' })
      const result = await polishText(trimmed, key, config.apiKey)
      setValue(result)
      Taro.showToast({ title: '润色完成', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '请求失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setPolishing(false)
    }
  }

  return (
    <View className="page-editor">
      <View className="label">
        <Text>{title}</Text>
      </View>
      <View className="toolbar">
        <Button plain className="toolbar-btn" size="mini" onClick={handlePasteFromClipboard}>从剪贴板粘贴</Button>
        <Button plain className="toolbar-btn" size="mini" onClick={handleChooseFile}>导入外部文档</Button>
        <Button plain className="toolbar-btn polish" size="mini" onClick={handlePolish} disabled={polishing}>
          {polishing ? '润色中…' : 'AI 润色'}
        </Button>
      </View>
      
      {/* 🌟 核心容器：包含输入框与独立的文件展示卡片 */}
      <View className="textarea-container">
        {/* 微信原生组件防穿透保护：预览时暂时隐藏 Textarea */}
        {!previewing && (
          <Textarea
            className="textarea"
            placeholder={placeholderText}
            value={value}
            maxlength={MAX_SETTING_CHARS}
            onInput={(e) => setValue(String(e.detail.value).slice(0, MAX_SETTING_CHARS))}
          />
        )}
        
        {/* 🌟 附件展示卡片 (类似文件夹) */}
        {attachedFile && (
          <View className="attached-file-card" onClick={() => setPreviewing(true)}>
            <View className="file-info-left">
              <Text className="file-icon">📄</Text>
              <View className="file-details">
                <Text className="file-name">{attachedFile.name}</Text>
                <Text className="file-size">{(attachedFile.size / 1024).toFixed(1)} KB</Text>
              </View>
            </View>
            <View className="file-remove" onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}>✕</View>
          </View>
        )}
      </View>

      <View className="hint-text">
        <Text>💡 您可以手动输入内容，或在下方附加1个 {(MAX_MD_FILE_BYTES / 1024).toFixed(0)}KB 内的参考文档，在 AI 生成时会把二者综合参考。</Text>
      </View>

      <Button className="btn-save" onClick={handleSave}>保存</Button>

      {/* 🌟 独立的文档预览全屏遮罩 */}
      {previewing && attachedFile && (
        <View className="preview-modal">
          <View className="preview-header">
            <Text className="title">{attachedFile.name}</Text>
            <Text className="close-btn" onClick={() => setPreviewing(false)}>关闭</Text>
          </View>
          <ScrollView scrollY className="preview-content">
            {/* 🌟 新增这一层 View 包裹文本 */}
            <View className="preview-text-container">
              <Text userSelect>{attachedFile.content}</Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  )
}