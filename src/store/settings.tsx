import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import type { SettingDocKey } from '@/types'
import { STORAGE_KEYS } from '@/constants/settings'

export type SettingsState = Record<SettingDocKey, string>

const defaultSettings: SettingsState = {
  characters: '',
  worldview: '',
  scenes: '',
  mainPlot: '',
  storyNodes: ''
}

type SettingsContextValue = {
  settings: SettingsState
  setOne: (key: SettingDocKey, value: string) => void
  setAll: (next: Partial<SettingsState>) => void
  load: () => Promise<void>
  save: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)

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
  }, [])

  const save = useCallback(async () => {
    await Taro.setStorage({ key: STORAGE_KEYS.SETTINGS, data: settings })
  }, [settings])

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

  const value: SettingsContextValue = {
    settings,
    setOne,
    setAll,
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
