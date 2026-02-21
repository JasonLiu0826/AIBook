export default defineAppConfig({
  pages: [
    'pages/index/index',         // 首页
    'pages/ai-model/index',      // AI模型配置
    'pages/webview/index',       // WebView页面
    'pages/settings/index',      // 后台设定（5类MD）
    'pages/config/index',        // 用户配置
    'pages/story-list/index',    // 故事列表（多故事）
    'pages/story/index',         // 阅读 + 分支选择
    'pages/editor/index'         // 单篇MD编辑
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1a1a2e',
    navigationBarTitleText: 'AI互动小说',
    navigationBarTextStyle: 'white'
  },
  // 权限配置
  permission: {
    "scope.writePhotosAlbum": {
      "desc": "用于保存导出的故事内容"
    },
    "scope.camera": {
      "desc": "用于扫描二维码导入内容"
    }
  },
  // 网络超时时间
  networkTimeout: {
    request: 10000,
    connectSocket: 10000,
    uploadFile: 10000,
    downloadFile: 10000
  }
})
