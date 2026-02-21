# AI 互动式小说生成器

React + TypeScript 架构，**小程序版优先**，后续可扩展 App 版（同一套 Taro 代码可编译 H5 / 微信小程序 / 多端）。

## 功能概览

- **后台设定（MD 文档）**：五类设定实时作为 AI 参考
  - 人物设定、故事背景/世界观、环境场景、故事主线、重要故事节点更新
- **用户配置**：单次输出字数、书写人称（第一/二/三人称）
- **章节输出**：每章带标题与序号
- **剧情分支**：章末三个选项 + 支持用户自定义输入分支
- **输入方式**：支持自定义 MD 文档或手动输入转 MD，存于本地；设定页支持**从剪贴板粘贴**、**选择聊天文件（MD/TXT）导入**
- **设定页 AI 润色**：手动输入内容可请求后端润色（接口预留，见 `api-contract.md`）
- **多故事**：故事列表管理多本书，按本存储章节，切换阅读
- **导出**：当前故事章节可导出为文本并复制到剪贴板
- **无后端体验**：未配置生成接口时，第一章使用 Mock 示例，并提示配置说明

## 技术栈

- **Taro 3** + **React 18** + **TypeScript**
- 编译目标：`weapp`（微信小程序）、`h5`（后续可做 App 壳或 PWA）

## 目录结构

```
src/
  app.tsx / app.config.ts   # 入口与路由
  pages/
    index/                  # 首页
    settings/               # 五类设定列表
    editor/                 # 单篇 MD 编辑（粘贴/文件导入、AI 润色）
    config/                 # 用户配置
    story-list/             # 故事列表（多故事）
    story/                  # 阅读 + 分支选择 + 续写 + 导出
  store/                    # 设定、用户配置、故事状态（多故事）
  services/ai.ts             # 生成接口（含 Mock）
  services/polish.ts        # 润色接口预留
  types/                    # 类型定义
  constants/                # 设定项常量
```

## 运行与构建

```bash
# 安装依赖
npm install

# 微信小程序开发（watch）
npm run dev:weapp

# 微信小程序生产构建
npm run build:weapp

# H5 开发（可选）
npm run dev:h5
```

微信小程序：用微信开发者工具打开项目根目录，将「本地设置」里的小程序目录指向 `dist`（Taro 输出目录）。

### 微信小程序连本地后端（解决 ERR_CONNECTION_REFUSED）

小程序里不能使用 `127.0.0.1`（会指向模拟器/手机本身）。需要：

1. **本机先启动后端**：`npm run dev:server`（或 `node server.js`），确保 `http://localhost:3000/generate/stream` 可访问。
2. **配置本机局域网 IP**：复制 `.env.example` 为 `.env.development`，设置：
   ```bash
   AIBOOK_API_BASE=http://你的电脑IP:3000
   ```
   例如 `AIBOOK_API_BASE=http://192.168.1.100:3000`（在命令行执行 `ipconfig` 查看本机 IPv4）。也可在运行前直接指定：`set AIBOOK_API_BASE=http://192.168.1.100:3000 && npm run dev:weapp`（Windows）或 `AIBOOK_API_BASE=http://192.168.1.100:3000 npm run dev:weapp`（Mac/Linux）。
3. **重新编译**：改完 env 后执行一次 `npm run dev:weapp`。
4. **开发者工具**：在「详情 → 本地设置」中勾选 **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**，否则请求会被拦截。

## 后端接口约定

生成接口由你自己实现（避免在小程序里暴露 API Key）。请求格式见 `src/services/ai.ts`，约定如下：

- **POST** `{baseURL}/generate`
- **Body**：`characters`, `worldview`, `scenes`, `mainPlot`, `storyNodes`（五类 MD 文本）、`singleOutputLength`、`pov`（人称文案）、`contextSummary`（前文摘要）、`chosenBranch`（用户选的分支）、`nextChapterIndex`
- **响应**：`{ title: string, content: string, branches: [string, string, string] }`

可在 `config/dev.js` 或环境变量中配置 `AIBOOK_API_BASE`，小程序后台需将该域名加入 request 合法域名。

## 后续（App 版）

- 同一套代码可用 Taro 编译为 **H5**，再配合 Capacitor / 微信小程序 等做 App 壳。
- 或使用 Taro 的 React Native 编译（需额外配置）。
