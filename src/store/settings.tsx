import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import type { SettingDocKey } from '@/types'
import { STORAGE_KEYS } from '@/constants/settings'

export type SettingsState = Record<SettingDocKey, string>
// 🌟 1. 定义附件数据结构
export type AttachedFile = { name: string; content: string; size: number }
export type AttachedFilesState = Record<SettingDocKey, AttachedFile | null>

const defaultSettings: SettingsState = {
  characters: '',
  worldview: '',
  scenes: '',
  mainPlot: '',
  storyNodes: ''
}

const defaultAttachedFiles: AttachedFilesState = {
  characters: null, worldview: null, scenes: null, mainPlot: null, storyNodes: null
}

type SettingsContextValue = {
  settings: SettingsState
  attachedFiles: AttachedFilesState // 🌟 新增导出
  setOne: (key: SettingDocKey, value: string) => void
  setAll: (next: Partial<SettingsState>) => void
  setAttachedFile: (key: SettingDocKey, file: AttachedFile | null) => void // 🌟 新增操作方法
  load: () => Promise<void>
  save: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [attachedFiles, setAttachedFilesState] = useState<AttachedFilesState>(defaultAttachedFiles)

  const load = useCallback(async () => {
    try {
      const raw = await Taro.getStorage({ key: STORAGE_KEYS.SETTINGS })
      const data = raw?.data as Partial<SettingsState> | undefined
      if (data && typeof data === 'object') {
        setSettings(s => ({ ...defaultSettings, ...s, ...data }))
      }
    } catch {
      setSettings(defaultSettings)
    }
    try {
      // 🌟 启动时加载所有区划的附件
      const rawFiles = await Taro.getStorage({ key: STORAGE_KEYS.ATTACHED_FILES })
      if (rawFiles?.data && typeof rawFiles.data === 'object') setAttachedFilesState(s => ({ ...defaultAttachedFiles, ...s, ...rawFiles.data }))
    } catch {}
  }, [])

  const save = useCallback(async () => {
    await Taro.setStorage({ key: STORAGE_KEYS.SETTINGS, data: settings })
    await Taro.setStorage({ key: STORAGE_KEYS.ATTACHED_FILES, data: attachedFiles }) // 🌟 保存时连同附件一起存
  }, [settings, attachedFiles])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    save()
  }, [settings, save])

  const setOne = useCallback((key: SettingDocKey, value: string) => {
    setSettings(s => ({ ...s, [key]: value }))
  }, [])

  const setAll = useCallback((next: Partial<SettingsState>) => {
    setSettings(s => ({ ...s, ...next }))
  }, [])
  
  // 🌟 新增操作方法
  const setAttachedFile = useCallback((key: SettingDocKey, file: AttachedFile | null) => {
    setAttachedFilesState(s => ({ ...s, [key]: file }))
  }, [])

  const value: SettingsContextValue = {
    settings,
    attachedFiles,
    setOne,
    setAll,
    setAttachedFile,
    load,
    save
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
