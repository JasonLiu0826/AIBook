/** 五类后台设定文档的 key */
export type SettingDocKey =
  | 'characters'      // 人物设定
  | 'worldview'       // 故事背景/世界观
  | 'scenes'          // 环境场景
  | 'mainPlot'        // 故事主线
  | 'storyNodes'      // 更新重要故事节点

/** 设定文档项（用于列表展示与编辑入口） */
export interface SettingDocMeta {
  key: SettingDocKey
  title: string
  placeholder?: string
}

// 1. 人称回归本质
export type NarrativePOV = 'first' | 'second' | 'third' | 'third_it'

// 2. 🌟 新增：独立的叙事视角枚举
export type NarrativePerspective = 'omniscient' | 'specific'

/** 用户配置（单次输出字数、人称等） */
export interface UserConfigState {
  /** 单次生成最大字数（或 token 数，按后端约定） */
  singleOutputLength: number
  /** 书写人称 */
  pov: NarrativePOV
  // 3. 🌟 新增配置字段
  perspective?: NarrativePerspective 
  specificCharacterName?: string
  /** AI模型提供商 */
  aiProvider: 'mock' | 'deepseek' | 'openai' | 'custom'
  /** API密钥 */
  apiKey?: string
  /** 自定义API地址 */
  customApiUrl?: string
  /** 触觉震动反馈开关 */
  enableVibration?: boolean
  /** 其他可扩展：如温度、模型等 */
  [key: string]: unknown
}

/** 剧情分支选项（章末三选一 + 自定义） */
export interface BranchOption {
  id: string
  text: string
  /** 是否为用户自定义输入 */
  isCustom?: boolean
}

/** 单章内容 */
export interface Chapter {
  id: string
  /** 序号，从 1 开始 */
  index: number
  title: string
  content: string
  /** 本章末尾的剧情分支选项（3 个固定 + 可选自定义） */
  branches: BranchOption[]
  /** 生成时间 */
  createdAt: number
  /** 新增：记录用户看完这一章后，最终选择了哪个分支文本 */
  selectedBranch?: string
}

/** 故事状态（单本书的会话） */
export interface StoryState {
  /** 当前故事下的所有章节（按顺序） */
  chapters: Chapter[]
  /** 当前选中的分支路径（用于回溯或展示树） */
  branchPath: string[]
  /** 是否正在生成中 */
  generating: boolean
}

/** 故事元信息（多故事列表项） */
export interface StoryMeta {
  id: string
  title: string
  createdAt: number
}

/** 生成结果：标题 + 正文 + 三个分支选项 */
export interface GenerateResult {
  title: string
  content: string
  branches: [string, string, string]
}

/** AI 生成请求参数（拼进 prompt 的设定与配置） */
export interface GenerateParams {
  /** 五类设定文档的 md 内容 */
  settings: Record<SettingDocKey, string>
  /** 用户配置 */
  userConfig: UserConfigState
  /** 已有章节摘要或最后几章内容，用于续写 */
  contextSummary?: string
  /** 用户选择的分支文本（或自定义输入） */
  chosenBranch?: string
  /** 下一章序号 */
  nextChapterIndex: number
}
