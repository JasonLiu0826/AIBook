import { useState, useEffect } from 'react'
import { View, Text, Picker, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useUserConfig } from '@/store/userConfig'
import './index.scss'

interface AIModelConfig {
  provider: 'deepseek' | 'custom'
  apiKey: string
  customApiUrl: string
}

export default function AIModelPage() {
  const { config, setConfig } = useUserConfig()
  const [localConfig, setLocalConfig] = useState<AIModelConfig>({
    provider: (config.aiProvider === 'deepseek' || config.aiProvider === 'custom') ? config.aiProvider : 'deepseek',
    apiKey: config.apiKey || '',
    customApiUrl: config.customApiUrl || ''
  })
  const [saving, setSaving] = useState(false)

  const providerOptions = [
    { label: 'DeepSeek大模型', value: 'deepseek' },
    { label: '自定义API', value: 'custom' }
  ]

  const handleProviderChange = (e: any) => {
    const selectedIndex = e.detail.value
    const selectedProvider = providerOptions[selectedIndex].value as 'deepseek' | 'custom'
    setLocalConfig(prev => ({
      ...prev,
      provider: selectedProvider
    }))
  }

  const handleSave = async () => {
    if (localConfig.provider !== 'custom' && !localConfig.apiKey.trim()) {
      Taro.showToast({
        title: '请输入API密钥',
        icon: 'none'
      })
      return
    }

    if (localConfig.provider === 'custom' && !localConfig.customApiUrl.trim()) {
      Taro.showToast({
        title: '请输入自定义API地址',
        icon: 'none'
      })
      return
    }

    setSaving(true)
    try {
      setConfig({
        aiProvider: localConfig.provider,
        apiKey: localConfig.apiKey,
        customApiUrl: localConfig.customApiUrl
      })
      
      Taro.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      // 延迟返回，让用户看到成功提示
      setTimeout(() => {
        const pages = Taro.getCurrentPages()
        if (pages.length > 1) {
          Taro.navigateBack()
        } else {
          // 如果是直接进入的该页面（无上一级），则回到首页
          Taro.reLaunch({ url: '/pages/index/index' })
        }
      }, 1500)
    } catch (error) {
      Taro.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleBuyToken = () => {
    Taro.navigateTo({
      url: '/pages/webview/index?url=https://platform.deepseek.com/'
    })
  }

  const getProviderInfo = () => {
    switch (localConfig.provider) {
      case 'deepseek':
        return {
          title: 'DeepSeek大模型',
          desc: '使用DeepSeek提供的AI大模型服务',
          showApiKey: true,
          showCustomUrl: false
        }
      case 'custom':
        return {
          title: '自定义API',
          desc: '连接您自己的AI服务接口，支持硅基流动、Kimi、GLM等兼容OpenAI格式的大模型平台',
          showApiKey: true,
          showCustomUrl: true
        }
      default:
        return {
          title: '',
          desc: '',
          showApiKey: false,
          showCustomUrl: false
        }
    }
  }

  const providerInfo = getProviderInfo()

  return (
    <View className="page-ai-model">
      <View className="header">
        <Text className="title">AI模型配置</Text>
        <Text className="subtitle">选择和配置您要使用的AI大模型</Text>
      </View>

      <View className="section">
        <Text className="section-title">选择AI服务商</Text>
        <Picker
          mode="selector"
          range={providerOptions.map(opt => opt.label)}
          onChange={handleProviderChange}
        >
          <View className="picker-item">
            <Text className="picker-label">
              {providerOptions.find(opt => opt.value === localConfig.provider)?.label}
            </Text>
            <Text className="picker-arrow">›</Text>
          </View>
        </Picker>
      </View>

      <View className="info-card">
        <Text className="info-title">{providerInfo.title}</Text>
        <Text className="info-desc">{providerInfo.desc}</Text>
      </View>

      {providerInfo.showApiKey && (
        <View className="section">
          <Text className="section-title">API密钥</Text>
          <Input
            className="input-field"
            placeholder={
              localConfig.provider === 'deepseek' 
                ? '请输入DeepSeek API密钥' 
                : '请输入API密钥'
            }
            value={localConfig.apiKey}
            onInput={(e) => setLocalConfig(prev => ({
              ...prev,
              apiKey: e.detail.value
            }))}
            password
          />
          
          {localConfig.provider === 'deepseek' && (
            <View className="token-purchase">
              <Text className="token-text">还没有API密钥？</Text>
              <Button 
                className="token-button" 
                onClick={handleBuyToken}
              >
                去购买Token
              </Button>
            </View>
          )}
        </View>
      )}

      {providerInfo.showCustomUrl && (
        <View className="section">
          <Text className="section-title">自定义API地址</Text>
          <Input
            className="input-field"
            placeholder="请输入API服务地址"
            value={localConfig.customApiUrl}
            onInput={(e) => setLocalConfig(prev => ({
              ...prev,
              customApiUrl: e.detail.value
            }))}
          />
        </View>
      )}

      <View className="actions">
        <Button 
          className="save-btn" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存配置'}
        </Button>
      </View>

      <View className="tips">
        <Text className="tips-title">💡 使用提示</Text>
        <Text className="tips-item"> DeepSeek：提供高质量的中文写作能力</Text>
        <Text className="tips-item"> 自定义API：支持硅基流动、Kimi、GLM等兼容OpenAI格式的大模型平台</Text>
        <Text className="tips-item"> API密钥会加密存储在本地</Text>
        <Text className="tips-item"> 更换模型后建议重新开始新故事</Text>
      </View>
    </View>
  )
}