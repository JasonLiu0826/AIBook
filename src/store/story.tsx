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
  // 👇 新增：删除和重命名方法
  deleteStory: (id: string) => Promise<void>
  renameStory: (id: string, newTitle: string) => Promise<void>
  // 👇 新增：更新上一章选择的方法
  updateLastChapterChoice: (choice: string) => void
}

const StoryContext = createContext<StoryContextValue | null>(null)

export function StoryProvider({ children }: { children: React.ReactNode }) {
  const [storyList, setStoryList] = useState<StoryMeta[]>([])
  const [currentStoryId, setCurrentStoryIdState] = useState<string | null>(null)
  const [currentStoryTitle, setCurrentStoryTitleState] = useState('')
  const [state, setState] = useState<StoryState>(defaultStoryState)
  const hasLoadedRef = useRef(false)
  const isSwitchingRef = useRef(false) // 🌟 新增：防覆盖锁

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
    isSwitchingRef.current = true // 🌟 开启锁
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
    } finally {
      setTimeout(() => { isSwitchingRef.current = false }, 100) // 🌟 解锁
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
    // 🌟 判断条件加上 isSwitchingRef.current
    if (!hasLoadedRef.current || !currentStoryId || isSwitchingRef.current) return
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
      isSwitchingRef.current = true // 🌟 开启防覆盖锁
      if (currentStoryId) {
         await saveCurrentStory() // 安全保存上一个故事
      }
      
      setCurrentStoryIdState(id)
      const meta = storyList.find((s) => s.id === id)
      setCurrentStoryTitleState(meta?.title || '')
      setState(defaultStoryState) // 清空视图
      
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
      } finally {
        setTimeout(() => { isSwitchingRef.current = false }, 100) // 🌟 载入完毕，解锁
      }
    },
    [storyList, saveCurrentStory, currentStoryId]
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

  // 👇 新增的删除逻辑
  const deleteStory = useCallback(async (id: string) => {
    setStoryList((prev) => {
      const next = prev.filter((s) => s.id !== id)
      saveStoryList(next)
      return next
    })
    try {
      await Taro.removeStorage({ key: STORAGE_STORY_PREFIX + id })
    } catch (e) {} // 忽略不存在时的报错
    
    // 如果删除的是正在看的故事，则退回空白状态
    if (currentStoryId === id) {
      isSwitchingRef.current = true // 🌟 删除清空时也要上锁
      setCurrentStoryIdState(null)
      setCurrentStoryTitleState('')
      resetStory()
      setTimeout(() => { isSwitchingRef.current = false }, 100)
    }
  }, [currentStoryId, saveStoryList, resetStory])

  // 👇 新增的重命名逻辑
  const renameStory = useCallback(async (id: string, newTitle: string) => {
    setStoryList((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
      saveStoryList(next)
      return next
    })
    if (currentStoryId === id) {
      setCurrentStoryTitleState(newTitle)
    }
  }, [currentStoryId, saveStoryList])

  // 👇 新增：更新上一章选择的方法
  const updateLastChapterChoice = useCallback((choice: string) => {
    setState((s) => {
      if (s.chapters.length === 0) return s;
      const newChapters = [...s.chapters];
      const lastIndex = newChapters.length - 1;
      newChapters[lastIndex] = {
        ...newChapters[lastIndex],
        selectedBranch: choice
      };
      return { ...s, chapters: newChapters };
    });
  }, []);

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
    saveCurrentStory,
    deleteStory,  // 暴露给外部使用
    renameStory,  // 暴露给外部使用
    updateLastChapterChoice  // 暴露给外部使用
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
