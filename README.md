# 美食剪刀布 · 网页版（开发说明）

今天想吃什么？打开网页，专挑附近 Google 评价最好的 3 家，再用剪刀石头布帮你决定。

网页版接替安卓版：以后只做网页版。上一层文件夹里的安卓版（`app/`、`README.md`、美食家报告、`测试截图/`）是**第四版的完整参考，只能看，不能改**。

## 常用命令

| 命令 | 做什么 |
| --- | --- |
| `npm install` | 安装依赖（不会下载浏览器，测试直接用本机的 Google Chrome） |
| `npm run dev` | 开发用，打开 http://localhost:5173/ ，改了代码马上看到 |
| `npm run build` | 打包到 `dist/`，并自动检查：类型、没有 Google 密钥、首屏 JS 不超过 200KB |
| `npm run preview` | 在 http://localhost:5180/ 看打包好的网页 |
| `npm run serve:subpath` | 模拟 GitHub Pages，在 http://127.0.0.1:5181/meishi-jiandaobu/ 看打包好的网页 |
| `npm test` | 单元测试（Vitest） |
| `npm run e2e` | 先打包，再用 Chrome 跑浏览器测试：手机 390×844、360×740、电脑 1280×800，加上响应式检查的 10 种尺寸（见下面「浏览器测试」） |
| `npm run shots` | 先打包，再截图：`screenshots/<尺寸>/`（可以用 `SHOTS_DIR=某个文件夹` 改位置），和每一块画面走一遍的整套截图 `测试截图-开发中/<哪一块>/<尺寸>/` |
| `npm run check:keys` | 单独检查 `dist/` 里有没有像 Google 密钥的字符串 |
| `npm run icons` | 改了图标图案以后，重新生成 `public/icons/` 里的图标 |

## 文件夹

```
index.html              网页入口（中文、不让浏览器整页翻译、刘海安全区、PWA 图标）
src/main.tsx            启动：先载入全局样式，查好定位权限，再画画面；注册离线缓存
src/App.tsx             整个网页的外框：标题栏、四个主画面切换、各种对话框、返回键、摇一摇、手机键盘
src/app/                状态层（安卓 MainViewModel）：store.ts、画面状态 state.ts、用哪句话 texts.ts、返回键顺序 navigation.ts
src/domain/             规则（纯函数）：排名、营业时间、随便挑、饭签、猜拳、饭桌…
src/services/           Google 请求、用量守卫、本机存储、演示假店
src/platform/           浏览器能力：定位、分享 / 复制、震动、摇一摇、内建翻译
src/screens/            主画面：首页、加载页、错误页、结果页
src/screens/game/       游戏层：剪刀石头布、帮我挑一家、🎡 转盘、「就这一家吧！」、🃏 任务卡、🎯 谁来做、彩带
src/screens/table/      👥 饭桌模式：第一页（几个人、头像）、✂️ 每人划一刀、🙈 暗中出拳
src/dialogs/            对话框：随便挑（老虎机）、今日饭签、想找多远的店？、设置、定位说明、愿赌服输、饭桌（改名字、要结束吗？）
src/ui/                 公共零件：标题栏、底栏、对话框外壳、提示条、按短句换行、一行放得下就一行、返回键历史
src/styles/             样式：global.css（颜色、字体、深色、减少动画）→ app.css（外框、按钮、对话框）→ 各画面
src/data/               从安卓导出的资料（文字、菜系、时段、饭签、演示店、颜色…），不要手改
src/sw/                 离线缓存（service worker）和缓存规则
public/                 原样复制的文件：manifest、图标
vite-plugins/           打包时生成 sw.js
scripts/                检查脚本（密钥、体积、简体字）、模拟 GitHub Pages 的服务器、图标生成
e2e/                    浏览器测试（见下面「测试怎么写」）
```

## 画面怎么排（手机优先、响应式）

- 手机竖屏是第一优先（320 到 430 宽都要好用），单栏；平板、电脑（768 以上）主栏最宽 35rem（560px）置中，两边暖色装饰，底栏跟着主栏宽度。
- 手机横屏（很矮）：首页标题挤一行、底栏把两个小胶囊放在三个大按钮左边；随便挑、饭签改左右两栏。
- 刘海和底部横条：标题栏用 `env(safe-area-inset-top)`，底栏用 `env(safe-area-inset-bottom)`；高度一律 `100dvh`，不用 `100vh`。
- 固定在最下面的底栏用 `src/ui/BottomBar.tsx`：它把自己的高度写进 `--bottom-bar-h`，内容区和提示条会自动让开。
- 可以点的东西至少 48×48（`var(--tap)`）、相邻按钮留空隙；正文 16px、最小的字 13px（`--fs-tiny`）；输入框 16px 以上（iPhone 不会自动放大）。
- 字号、间距用 rem（跟着系统字体放大）；当图案用的 emoji 用 px（照安卓：字会放大，emoji 不会把按钮撑爆）。
- 很窄的时候用容器查询（`@container`）改排法，例如菜系格子每行 4 → 3 → 2 个、演示黑条的「关掉」换到下一行。
- 按下去有反馈（`:active` 缩小一点），不靠鼠标悬停；连点两下不会放大页面（`touch-action: manipulation`）。

## 一定要遵守的规矩

1. **永远免费。** 每次搜索最多 3 个文字搜索请求；每月最多 900 次文字搜索 + 900 次照片请求（按美国洛杉矶时间算月份）。不能加任何会让 Google 收费的请求。
2. **密钥只放在用户自己的浏览器里**（localStorage）。不能写进源代码、`.env` 或打包结果。`npm run build` 会自动检查，发现 `AIza` 开头的密钥就失败。环境变量只有 `MEISHI_PUBLIC_` 开头的才会被打包进网页，不要拿来放密钥。
3. **不需要服务器、不需要账号。** 网页放在 GitHub Pages 的子路径下，所以：
   - 网址和文件路径一律用相对路径（`./`），不要写 `/assets/...` 这种绝对路径；
   - 换画面用 React 的状态，或者 `#/` 开头的网址，不要用 `/settings` 这种路径（刷新会 404）。
4. **只用简体中文，口吻自然，跟安卓第四版一致。** `npm test` 会把整个网页项目扫一遍，有繁体字就失败。
5. **手机要打开得快。** 首屏 JavaScript（gzip 后）不超过 200KB，超过了构建会失败。不要加笨重的库；动画用 CSS 或 Web Animations。
6. **手机优先，照顾所有人：**
   - 颜色一律用 `global.css` 里的变量（`var(--color-primary)` 等），深色模式就自动有了；
   - 字体、间距、按钮高度都用 `rem`，用户把字调大也不会挤爆；按钮至少 `var(--tap-min)`（48px）高；
   - 用户开了「减少动画」，动画要马上走完（CSS 已经处理；Web Animations 用 `playAnimation()`）。

## 测试怎么写

- 单元测试放在要测的文件旁边，叫 `xxx.test.ts(x)`。测试名开头写 `web-移植资料/测试用例.md` 的编号（例如 `it('RANK-03 …')`），方便数有没有漏。
- 状态层（对应安卓 MainViewModel）的测试在 `src/app/store*.test.ts`，用 `src/test/storeHarness.ts` 的 `Harness`：定位、Google、照片、翻译、时钟、随机数全是假的。
  - `h.store(种子)` = 新开一个分页（sessionStorage 是空的）；`h.store(种子, h.afterProcessDeath())` = 同一个分页被丢掉再载入；
  - 设置、用量、吃过的记录、这一餐的决定放在架子里，所有分页共用（= localStorage）。
- 「永远免费」的测试在 `src/app/freeOfCharge.test.ts`：用真的请求层（`PlacesApi` + `GooglePlacesClient`）接模拟的 Google（`src/test/mockFetch.ts`），整轮玩一遍再数请求。新加会发请求的功能，一定要在这里补测试。
- `scripts/build-output.test.ts` 会真的打包一次（放在临时文件夹，不碰 `dist`），检查没有密钥、全是相对路径、首屏 JS 不超过 200KB。
- 浏览器测试从 `e2e/fixtures.ts` 引入 `test` 和 `expect`：
  - 测试里**连不到任何外部网站**，连了就算失败。要测 Google 接口，用 `mockGoogleApi(context, …)` 模拟，**绝不用真的密钥**；
  - 网页上有错误（console.error）也算失败；
  - `freezeTime(page, '2026-10-17T19:30:00+08:00')` 把时间定在吉隆坡晚上 7 点半；
  - 默认已经允许定位，位置在吉隆坡茨厂街（3.1440, 101.6979），可以用 `context.setGeolocation()` 换；
  - `setFontScale(page, 1.3)` 模拟字体放大 1.3 倍，`page.emulateMedia({ colorScheme: 'dark' })` 看深色模式；
  - `saveShot(page, testInfo, '05-结果页-晚上7点半')` 截图存到 `screenshots/<尺寸>/`。
- 浏览器测试的手机语言故意设成英文（en-MY）：马来西亚很多人的手机是英文的，网页照样要显示中文。
- 响应式（RWD）检查在 `e2e/rwd.spec.ts`（第 1、2 块）和 `e2e/rwd-games.spec.ts`（第 3、4 块），尺寸在 `e2e/sizes.ts`：320×568、Galaxy S 360×780、iPhone SE 375×667、390×844、Pixel 7 412×915、iPhone 15 Pro Max 430×932、手机横屏 844×390、iPad Mini 768×1024、电脑 1280×800，再加一个「浏览器放大 200%」。每个画面用 `checkRwd(page, '画面名', [主要按钮…])` 检查：没有横向滚动、可以点的东西至少 44×44、主要按钮完整在画面里（滑得到也算）而且没被挡住。**做好一块画面，就把那一块的画面加进这里。**
- 每一块画面另外有一个「走一遍并截图」的文件（`e2e/walkthrough-block1.spec.ts` … `walkthrough-block4.spec.ts`，标了 `@shots`，`npm run shots` 才跑），截图存到 `测试截图-开发中/<哪一块>/<尺寸>/`，拍完用眼睛看一遍。
- `e2e/block1.spec.ts`：第 1 块（框架、首页、随便挑、饭签）在真浏览器里的检查——浏览器返回键、重新整理、深色模式、减少动画、字体 1.3 倍、只问定位。
- `e2e/block2.spec.ts`：第 2 块（搜索流程、结果页、设置）在真浏览器里的检查——结果页第一屏看得到几家（WEB-24）、演示 0 个请求、真实模式每次搜索最多 3 个请求 + 每家最多 1 张照片、分享 / 复制（WEB-19）、导航（WEB-20）、时间在走、手机键盘、返回键和重新整理、「 · 」不挂在行尾、电脑 Chrome 的内建翻译（WEB-26）、减少动画、深色模式。
- `e2e/block3.spec.ts`：第 3 块（游戏层、「就这一家吧！」、任务卡、愿赌服输）在真浏览器里的检查——有动画时真的播完（App 的手、转盘不会卡住）、彩带画在内容下面、减少动画（WEB-22，投票平票的转盘也直接停好）、告诉朋友（WEB-19）、导航过去（WEB-20）、返回键和重新整理、深色模式。
- `e2e/block4.spec.ts`：第 4 块（👥 饭桌模式）在真浏览器里的检查——划刀的印章、撕开、收起真的播完，撤销马上回来；暗中出拳一起翻牌后 1.8 秒自己看结果；返回键 / Esc 玩到一半先问；重新整理后饭桌不留；中文输入法打名字；深色模式。
- `e2e/game-helpers.ts`：游戏和饭桌共用的步骤（`demoResults()`、`circle(page, n)` 圈 n 家、`openTableWithFour()`、`openTableFromRps()`、`pickPlayers()`、`playRps()`、`secretHands()`）。
- `e2e/results-helpers.ts`：`stubDeviceApis()`（不打开真的分享面板、不真的开新分页，改成记下来复制了什么、开了哪个网址）、`mockPlacesWithPhotos()`（模拟的 Google：三个关键词各回一组编出来的店，加上照片网址和假照片）。
- `e2e/fixtures.ts` 还有：`blockLocation()`（让浏览器挡住定位）、`chineseStreak()`（连吃 3 次中餐的记录）、`losAngelesMonth()`（用量记在哪个月）、`FAKE_KEY`（格式对但不是真的密钥，只用来看真实模式的画面，不会按搜索）。
- 浏览器的内建翻译（Chrome 电脑版的 Translator API）在测试里**默认拿掉**（像手机一样显示原名 + 大概意思；真的用会在背景下载翻译模型）。要看电脑 Chrome「机翻」那条路，在 describe 里写 `test.use({ builtInTranslator: 'fake' })`，换成按对照表马上翻好的假翻译器（`FAKE_TRANSLATIONS`）。

## 动画怎么写

- 动画用 CSS 或 Web Animations（`src/lib/motion.ts` 的 `playAnimation()`，「减少动画」时直接跳到最后一帧）。
- 要等动画播完才做的事（App 的手停下、任务卡翻开、划掉的卡收起来），一律用 `onAnimationDone(animation, …)`（等 `animation.finished`），不要用 `onfinish`：「减少动画」时动画一下子就播完，`onfinish` 有时会漏掉，画面就卡住了。
- 🎡 转盘（`LuckyWheel`）一打开就要转的（投票平票、谁来做、暗中出拳平票），「减少动画」时直接停在结果，也一定会叫一次 `onStopped`。

## 离线缓存

- 只缓存我们自己网站上的文件（网页、JS、CSS、图标）。打开过一次以后，没网也能打开。
- **Google 的接口和照片绝不缓存，也不经过 service worker**（规则在 `src/sw/cache-rules.ts`，有单元测试和浏览器测试）。
- 每次发布新版，文件内容一变，版本号就变，旧缓存会自动清掉。用户打开网页时会在后台下载新版，再打开一次就是新版。
- 还开着的旧页面如果要按需加载旧版的文件（已经被新版换掉），会自动重新打开一次，直接换成新版（`src/lib/reload-on-update.ts`，一分钟内最多一次）。
