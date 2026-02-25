import { useState, useEffect } from 'react'
import { View, Text, Picker, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useUserConfig } from '@/store/userConfig'
import { PRESET_MODELS } from '@/constants/settings'
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

  const handleModelChange = (e: any) => {
    const selectedIndex = e.detail.value;
    const selectedModel = PRESET_MODELS[selectedIndex];
    
    // 根据选择的模型设置provider
    let newProvider: 'deepseek' | 'custom';
    if (selectedModel.label === 'DeepSeek (性价比首选)') {
      newProvider = 'deepseek';
    } else if (selectedModel.label === 'Kimi / 月之暗面 (长文本强)' || 
             selectedModel.label === '智谱清言 (国内稳定)') {
      newProvider = 'custom';
    } else {
      // 自定义选项
      newProvider = 'custom';
    }
    
    setLocalConfig(prev => ({
      ...prev,
      provider: newProvider,
      customApiUrl: selectedModel.baseURL
    }));
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
    // 精确匹配：按预设模型顺序查找
    let currentModel: typeof PRESET_MODELS[0] | undefined;
    
    // 1. 先检查自定义选项
    if (localConfig.provider === 'custom' && (!localConfig.customApiUrl || localConfig.customApiUrl === '')) {
      currentModel = PRESET_MODELS.find(m => m.label === '自定义 (高阶用户)');
    }
    // 2. 再检查DeepSeek
    else if (localConfig.provider === 'deepseek' && localConfig.customApiUrl === 'https://api.deepseek.com/v1') {
      currentModel = PRESET_MODELS.find(m => m.label === 'DeepSeek (性价比首选)');
    }
    // 3. 检查Kimi
    else if (localConfig.provider === 'custom' && localConfig.customApiUrl === 'https://api.moonshot.cn/v1') {
      currentModel = PRESET_MODELS.find(m => m.label === 'Kimi / 月之暗面 (长文本强)');
    }
    // 4. 检查智谱清言
    else if (localConfig.provider === 'custom' && localConfig.customApiUrl === 'https://open.bigmodel.cn/api/paas/v4') {
      currentModel = PRESET_MODELS.find(m => m.label === '智谱清言 (国内稳定)');
    }
    
    if (currentModel && currentModel.label !== '自定义 (高阶用户)') {
      return {
        title: currentModel.label,
        desc: `使用${currentModel.label.split(' ')[0]}提供的AI大模型服务`,
        showApiKey: true,
        showCustomUrl: false
      }
    } else {
      return {
        title: '自定义API',
        desc: '连接您自己的AI服务接口，支持任何兼容OpenAI格式的大模型平台',
        showApiKey: true,
        showCustomUrl: true
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
          range={PRESET_MODELS.map(model => model.label)}
          onChange={handleModelChange}
        >
          <View className="picker-item">
            <Text className="picker-label">
              {(() => {
                // 优先匹配当前配置
                const matchedModel = PRESET_MODELS.find(model => {
                  if (model.label === '自定义 (高阶用户)') {
                    return localConfig.provider === 'custom' && (!localConfig.customApiUrl || localConfig.customApiUrl === '');
                  }
                  return model.baseURL === localConfig.customApiUrl;
                });
                
                if (matchedModel) {
                  return matchedModel.label;
                }
                
                // 如果没有匹配到，根据provider显示默认选项
                if (localConfig.provider === 'deepseek') {
                  return 'DeepSeek (性价比首选)';
                } else if (localConfig.provider === 'custom') {
                  return '自定义 (高阶用户)';
                }
                
                return '请选择模型';
              })()}
            </Text>
            <Text className="picker-arrow">›</Text>
          </View>
        </Picker>
      </View>

      <View className="info-card">
        <Text className="info-title">{providerInfo.title}</Text>
        <Text className="info-desc">{providerInfo.desc}</Text>
      </View>

      {/* 隐私保护声明 */}
      <View className="privacy-notice">
        <Text className="privacy-icon">🔒</Text>
        <Text className="privacy-text">隐私保护：API密钥和小说数据均加密存储于本地，AI请求直接发往模型厂商，不经过开发者服务器。</Text>
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
        <Text className="tips-item"> 自定义API：支持任何兼容OpenAI格式的大模型平台</Text>
        <Text className="tips-item"> API密钥会加密存储在本地，不会上传，无需担心泄露问题</Text>
        <Text className="tips-item"> 各模型理解能力存在差异，更换模型后建议重新开始新故事</Text>
      </View>
    </View>
  )
}