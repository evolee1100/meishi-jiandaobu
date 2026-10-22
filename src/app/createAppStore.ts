/**
 * 正式网页用的组装：localStorage / sessionStorage、真的 Google（密钥只从 localStorage 读）、浏览器定位、
 * 浏览器内建翻译（有才用）、演示假店。画面在启动时 await createAppStore() 一次，之后只用回传的 store。
 */
import { ChineseLocalizer } from '../domain/localizer.ts'
import { BrowserLocationSource } from '../platform/browserLocation.ts'
import { BrowserNameTranslator, noTranslator } from '../platform/browserTranslator.ts'
import { onPageResume } from '../platform/device.ts'
import { StoredGameStore } from '../services/gameStore.ts'
import { PlacesApi } from '../services/placesApi.ts'
import { GooglePlacesClient } from '../services/placesRepository.ts'
import { StoredSettings } from '../services/settings.ts'
import { browserLocalStore, browserSessionStore, isWritable, requestPersistentStorage } from '../services/storage.ts'
import { UsageGuard } from '../services/usageGuard.ts'
import { StoredVisitStore } from '../services/visitStore.ts'
import { MainStore } from './store.ts'

export interface AppServices {
  readonly store: MainStore
  /** 拆掉「回到页面」的监听（测试或热更新用）。 */
  readonly dispose: () => void
}

export async function createAppStore(): Promise<AppServices> {
  const local = browserLocalStore()
  const settings = new StoredSettings(local)
  const usageGuard = new UsageGuard(local)
  const apiKey = () => settings.effectiveApiKey()
  const api = new PlacesApi({ apiKey, usageGuard })
  const places = new GooglePlacesClient({ api, usageGuard, apiKey, usageStore: local })
  const translator = new BrowserNameTranslator()
  const location = await BrowserLocationSource.create()
  void requestPersistentStorage()
  const store = new MainStore({
    location,
    places,
    localizer: new ChineseLocalizer(translator.supported ? translator : noTranslator),
    usageGuard,
    settings,
    session: browserSessionStore(),
    visitStore: new StoredVisitStore(local),
    gameStore: new StoredGameStore(local),
    storageWritable: () => isWritable(local),
    primeTranslator: () => translator.prime(),
  })
  const stopResume = onPageResume(() => void store.resume())
  return {
    store,
    dispose: () => {
      stopResume()
      store.dispose()
    },
  }
}
