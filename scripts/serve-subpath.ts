/**
 * 模拟 GitHub Pages：把 dist 放在子路径下面（默认 http://127.0.0.1:5181/meishi-jiandaobu/）。
 * 跟 GitHub Pages 一样，没有的路径就 404（不会自动退回 index.html），
 * 所以浏览器测试能抓到「用了服务器路由」或「写了绝对路径」的问题。
 * 用法：node scripts/serve-subpath.ts   （可以用 PORT、BASE_PATH 环境变量改）
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import path from 'node:path'

const PORT = Number(process.env.PORT ?? 5181)
const BASE_PATH = normalizeBase(process.env.BASE_PATH ?? '/meishi-jiandaobu/')
const DIST = path.resolve(process.env.DIST_DIR ?? 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
}

function normalizeBase(base: string): string {
  return `/${base.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')
}

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error(`❌ 找不到 ${DIST}/index.html，请先运行 npm run build`)
  process.exit(1)
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const pathname = decodeURIComponent(url.pathname)

  // /meishi-jiandaobu → /meishi-jiandaobu/（GitHub Pages 也会这样跳）
  if (`${pathname}/` === BASE_PATH) {
    response.writeHead(301, { Location: BASE_PATH + url.search })
    response.end()
    return
  }
  if (!pathname.startsWith(BASE_PATH)) {
    notFound(response)
    return
  }

  let file = path.join(DIST, pathname.slice(BASE_PATH.length))
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    notFound(response)
    return
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
  if (!existsSync(file) || !statSync(file).isFile()) {
    notFound(response)
    return
  }

  response.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    // GitHub Pages 给所有文件都是 10 分钟缓存
    'Cache-Control': 'max-age=600',
  })
  if (request.method === 'HEAD') response.end()
  else createReadStream(file).pipe(response)
})

function notFound(response: ServerResponse) {
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end('404 找不到这个文件')
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🍜 模拟 GitHub Pages：http://127.0.0.1:${PORT}${BASE_PATH}`)
})
