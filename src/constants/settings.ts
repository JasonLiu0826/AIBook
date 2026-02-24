/*
 * @Author: jason 1917869590@qq.com
 * @Date: 2026-02-21 01:42:19
 * @LastEditors: jason 1917869590@qq.com
 * @LastEditTime: 2026-02-24 17:11:29
 * @FilePath: \AIBook_React_TypeScript\src\constants\settings.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import type { SettingDocMeta } from '@/types'

export const SETTING_DOCS: SettingDocMeta[] = [
  { key: 'characters', title: '人物设定', placeholder: '请详细填写主角及重要配角。\n强烈推荐使用下方的【AI润色】功能，AI会自动将其提炼为：“名字--性格--外貌--身份”的标准结构。\n注：若使用第一/第二人称，请务必详细描写主角。' },
  { key: 'worldview', title: '故事背景与世界观', placeholder: '时代、地点、规则、势力等…' },
  { key: 'scenes', title: '环境与场景设定', placeholder: '常用场景、氛围、细节…' },
  { key: 'mainPlot', title: '故事主线设定', placeholder: '主线目标、冲突、大事件…' },
  { key: 'storyNodes', title: '重要故事节点更新', placeholder: '随剧情更新重要节点…（无需填写，AI会实时更新）' }
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
