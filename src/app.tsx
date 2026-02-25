/*
 * @Author: jason 1917869590@qq.com
 * @Date: 2026-02-21 01:40:48
 * @LastEditors: jason 1917869590@qq.com
 * @LastEditTime: 2026-02-25 19:40:03
 * @FilePath: \AIBook_React_TypeScript\src\app.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { useLaunch } from '@tarojs/taro'
import { SettingsProvider } from '@/store/settings'
import { UserConfigProvider } from '@/store/userConfig'
import { StoryProvider } from '@/store/story'
import './app.scss'

function App({ children }: { children: React.ReactNode }) {
  useLaunch(() => {
    console.log('RealmCrafter 启动')
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
