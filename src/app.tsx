import { useLaunch } from '@tarojs/taro'
import { SettingsProvider } from '@/store/settings'
import { UserConfigProvider } from '@/store/userConfig'
import { StoryProvider } from '@/store/story'
import './app.scss'

function App({ children }: { children: React.ReactNode }) {
  useLaunch(() => {
    console.log('AI互动小说 启动')
  })
  return (
    <SettingsProvider>
      <UserConfigProvider>
        <StoryProvider>
          {children}
        </StoryProvider>
      </UserConfigProvider>
    </SettingsProvider>
  )
}

export default App
