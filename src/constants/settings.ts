import type { SettingDocMeta } from '@/types'

export const SETTING_DOCS: SettingDocMeta[] = [
  { key: 'characters', title: '人物设定', placeholder: '在此填写角色姓名、性格、关系等…' },
  { key: 'worldview', title: '故事背景与世界观', placeholder: '时代、地点、规则、势力等…' },
  { key: 'scenes', title: '环境与场景设定', placeholder: '常用场景、氛围、细节…' },
  { key: 'mainPlot', title: '故事主线设定', placeholder: '主线目标、冲突、大事件…' },
  { key: 'storyNodes', title: '重要故事节点更新', placeholder: '随剧情更新重要节点…' }
]

export const STORAGE_KEYS = {
  SETTINGS: 'aibook_settings',
  USER_CONFIG: 'aibook_user_config',
  STORY: 'aibook_story',
  STORY_LIST: 'aibook_story_list',
  AI_CONFIG: 'aibook_ai_config'
} as const

/** 单本故事的 storage key 前缀，后缀为 storyId */
export const STORAGE_STORY_PREFIX = 'aibook_story_'

/** 五类设定每区最大字数 */
export const MAX_SETTING_CHARS = 1000

/** 导入的 MD/文档最大体积（字节），1KB */
export const MAX_MD_FILE_BYTES = 1024
