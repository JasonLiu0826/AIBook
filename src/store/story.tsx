import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import type { Chapter, StoryState, StoryMeta } from '@/types'
import { STORAGE_KEYS, STORAGE_STORY_PREFIX } from '@/constants/settings'

const defaultStoryState: StoryState = {
  chapters: [],
  branchPath: [],
  generating: false
}

function genStoryId() {
  return `story_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

type StoryContextValue = StoryState & {
  storyList: StoryMeta[]
  currentStoryId: string | null
  currentStoryTitle: string
  addChapter: (chapter: Chapter) => void
  setGenerating: (v: boolean) => void
  resetStory: () => void
  createStory: () => string
  switchStory: (id: string) => Promise<void>
  setCurrentStoryTitle: (title: string) => void
  loadStoryList: () => Promise<void>
  loadCurrentStory: () => Promise<void>
  saveCurrentStory: () => Promise<void>
}

const StoryContext = createContext<StoryContextValue | null>(null)

export function StoryProvider({ children }: { children: React.ReactNode }) {
  const [storyList, setStoryList] = useState<StoryMeta[]>([])
  const [currentStoryId, setCurrentStoryIdState] = useState<string | null>(null)
  const [currentStoryTitle, setCurrentStoryTitleState] = useState('')
  const [state, setState] = useState<StoryState>(defaultStoryState)
  const hasLoadedRef = useRef(false)

  const loadStoryList = useCallback(async () => {
    try {
      const raw = await Taro.getStorage({ key: STORAGE_KEYS.STORY_LIST })
      const list = (raw?.data as StoryMeta[] | undefined) || []
      setStoryList(Array.isArray(list) ? list : [])
    } catch {
      setStoryList([])
    }
  }, [])

  const saveStoryList = useCallback(async (list: StoryMeta[]) => {
    await Taro.setStorage({ key: STORAGE_KEYS.STORY_LIST, data: list })
  }, [])

  const loadCurrentStory = useCallback(async () => {
    if (!currentStoryId) {
      setState(defaultStoryState)
      return
    }
    try {
      const raw = await Taro.getStorage({ key: STORAGE_STORY_PREFIX + currentStoryId })
      const data = raw?.data as Partial<StoryState> | undefined
      if (data && typeof data === 'object' && Array.isArray(data.chapters)) {
        setState({
          ...defaultStoryState,
          chapters: data.chapters ?? [],
          branchPath: data.branchPath ?? []
        })
      } else {
        setState(defaultStoryState)
      }
    } catch {
      setState(defaultStoryState)
    }
  }, [currentStoryId])

  const saveCurrentStory = useCallback(async () => {
    if (!currentStoryId) return
    await Taro.setStorage({
      key: STORAGE_STORY_PREFIX + currentStoryId,
      data: { chapters: state.chapters, branchPath: state.branchPath }
    })
  }, [currentStoryId, state.chapters, state.branchPath])

  useEffect(() => {
    loadStoryList().then(() => {
      hasLoadedRef.current = true
    })
  }, [loadStoryList])

  useEffect(() => {
    if (!hasLoadedRef.current || !currentStoryId) return
    saveCurrentStory()
  }, [state.chapters, state.branchPath, currentStoryId])

  const addChapter = useCallback((chapter: Chapter) => {
    setState((s) => ({
      ...s,
      chapters: [...s.chapters, chapter],
      branchPath: [...s.branchPath, chapter.id]
    }))
  }, [])

  const setGenerating = useCallback((generating: boolean) => {
    setState((s) => ({ ...s, generating }))
  }, [])

  const resetStory = useCallback(() => {
    setState(defaultStoryState)
  }, [])

  const createStory = useCallback(() => {
    const id = genStoryId()
    const title = `故事 ${storyList.length + 1}`
    const meta: StoryMeta = { id, title, createdAt: Date.now() }
    setStoryList((prev) => {
      const next = [...prev, meta]
      saveStoryList(next)
      return next
    })
    setCurrentStoryIdState(id)
    setCurrentStoryTitleState(title)
    setState(defaultStoryState)
    return id
  }, [storyList.length, saveStoryList])

  const switchStory = useCallback(
    async (id: string) => {
      await saveCurrentStory()
      setCurrentStoryIdState(id)
      const meta = storyList.find((s) => s.id === id)
      setCurrentStoryTitleState(meta?.title || '')
      setState(defaultStoryState)
      try {
        const raw = await Taro.getStorage({ key: STORAGE_STORY_PREFIX + id })
        const data = raw?.data as Partial<StoryState> | undefined
        if (data && typeof data === 'object' && Array.isArray(data.chapters)) {
          setState({
            ...defaultStoryState,
            chapters: data.chapters ?? [],
            branchPath: data.branchPath ?? []
          })
        }
      } catch {
        setState(defaultStoryState)
      }
    },
    [storyList, saveCurrentStory]
  )

  const setCurrentStoryTitle = useCallback(
    (title: string) => {
      setCurrentStoryTitleState(title)
      if (!currentStoryId) return
      setStoryList((prev) => {
        const next = prev.map((s) => (s.id === currentStoryId ? { ...s, title } : s))
        saveStoryList(next)
        return next
      })
    },
    [currentStoryId, saveStoryList]
  )

  const value: StoryContextValue = {
    ...state,
    storyList,
    currentStoryId,
    currentStoryTitle,
    addChapter,
    setGenerating,
    resetStory,
    createStory,
    switchStory,
    setCurrentStoryTitle,
    loadStoryList,
    loadCurrentStory,
    saveCurrentStory
  }

  return (
    <StoryContext.Provider value={value}>
      {children}
    </StoryContext.Provider>
  )
}

export function useStory() {
  const ctx = useContext(StoryContext)
  if (!ctx) throw new Error('useStory must be used within StoryProvider')
  return ctx
}
