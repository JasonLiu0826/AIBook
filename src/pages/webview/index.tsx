import { useState, useEffect } from 'react'
import { View, Text, WebView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function WebViewPage() {
  const [url, setUrl] = useState('')

  useEffect(() => {
    // 获取传递的URL参数
    const params = Taro.getCurrentInstance().router?.params
    if (params?.url) {
      setUrl(decodeURIComponent(params.url))
    } else {
      // 默认跳转到DeepSeek官网
      setUrl('https://platform.deepseek.com/')
    }
  }, [])

  const handleBack = () => {
    Taro.navigateBack()
  }

  const getTitleFromUrl = () => {
    if (url.includes('deepseek.com')) {
      return 'DeepSeek平台'
    }
    return '外部链接'
  }

  return (
    <View className="page-webview">
      <View className="webview-header">
        <Text className="back-btn" onClick={handleBack}>‹</Text>
        <Text className="webview-title">{getTitleFromUrl()}</Text>
      </View>
      <View className="webview-container">
        {url ? (
          <WebView src={url} />
        ) : (
          <View className="loading">
            <Text>加载中...</Text>
          </View>
        )}
      </View>
    </View>
  )
}