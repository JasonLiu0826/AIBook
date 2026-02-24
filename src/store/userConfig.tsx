import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import type { UserConfigState, NarrativePOV } from '@/types'
import { STORAGE_KEYS } from '@/constants/settings'

const defaultUserConfig: UserConfigState = {
  singleOutputLength: 800,
  pov: 'third',
  aiProvider: 'mock',
  apiKey: '',
  customApiUrl: ''
}

type UserConfigContextValue = {
  config: UserConfigState
  setConfig: (next: Partial<UserConfigState>) => void
  setPOV: (pov: NarrativePOV) => void
  setSingleOutputLength: (n: number) => void
  setEnableVibration: (enabled: boolean) => void
  load: () => Promise<void>
  save: () => Promise<void>
}

const UserConfigContext = createContext<UserConfigContextValue | null>(null)

export function UserConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<UserConfigState>(defaultUserConfig)

  const load = useCallback(async () => {
    try {
      const raw = await Taro.getStorage({ key: STORAGE_KEYS.USER_CONFIG })
      const data = raw?.data as Partial<UserConfigState> | undefined
      if (data && typeof data === 'object') {
        setConfigState(c => ({ ...defaultUserConfig, ...c, ...data }))
      }
    } catch {
      setConfigState(defaultUserConfig)
    }
  }, [])

  const save = useCallback(async () => {
    await Taro.setStorage({ key: STORAGE_KEYS.USER_CONFIG, data: config })
  }, [config])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    save()
  }, [config, save])

  const setConfig = useCallback((next: Partial<UserConfigState>) => {
    setConfigState(c => ({ ...c, ...next }))
  }, [])

  const setPOV = useCallback((pov: NarrativePOV) => {
    setConfigState(c => ({ ...c, pov }))
  }, [])

  const setSingleOutputLength = useCallback((singleOutputLength: number) => {
    setConfigState(c => ({ ...c, singleOutputLength }))
  }, [])

  const setEnableVibration = useCallback((enableVibration: boolean) => {
    setConfigState(c => ({ ...c, enableVibration }))
  }, [])

  const value: UserConfigContextValue = {
    config,
    setConfig,
    setPOV,
    setSingleOutputLength,
    setEnableVibration,
    load,
    save
  }

  return (
    <UserConfigContext.Provider value={value}>
      {children}
    </UserConfigContext.Provider>
  )
}

export function useUserConfig() {
  const ctx = useContext(UserConfigContext)
  if (!ctx) throw new Error('useUserConfig must be used within UserConfigProvider')
  return ctx
}
