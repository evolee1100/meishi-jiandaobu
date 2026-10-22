// 全局样式要最先载入（颜色、字体、基础规则），画面的样式在后面，同样权重时画面的规则说了算。
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { createAppStore } from './app/createAppStore.ts'
import { registerServiceWorker } from './lib/register-sw.ts'
import { reloadOnStaleAssets } from './lib/reload-on-update.ts'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('找不到 #root')
const root = createRoot(rootElement)

// 先查好定位权限（很快），再画第一个画面；查的时候只有底色，不会白闪。
void createAppStore().then(({ store }) => {
  root.render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  )
})

registerServiceWorker()
reloadOnStaleAssets()
