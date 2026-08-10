import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')
const serverDir = path.join(distDir, 'server')
const hostingDir = path.join(distDir, '.openai')

// GitHub Pages serves this fallback for client-side routes such as /admin.
await copyFile(path.join(distDir, 'index.html'), path.join(distDir, '404.html'))

// Materialize public routes so direct links return HTTP 200 on static hosts.
for (const route of ['admin', 'rankings', 'teams', 'groups', 'matches', 'history']) {
  const routeDir = path.join(distDir, route)
  await mkdir(routeDir, { recursive: true })
  await copyFile(path.join(distDir, 'index.html'), path.join(routeDir, 'index.html'))
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
])

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name)
    const relativePath = path.relative(distDir, absolutePath).replaceAll(path.sep, '/')

    if (relativePath.startsWith('server/') || relativePath.startsWith('.openai/')) continue

    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath)))
    } else {
      files.push(absolutePath)
    }
  }

  return files
}

const files = await listFiles(distDir)
const assets = {}

for (const file of files) {
  const relativePath = `/${path.relative(distDir, file).replaceAll(path.sep, '/')}`
  const content = await readFile(file)
  const mimeType = mimeTypes.get(path.extname(file).toLowerCase()) || 'application/octet-stream'

  assets[relativePath] = {
    body: content.toString('base64'),
    mimeType,
  }
}

await mkdir(serverDir, { recursive: true })
await mkdir(hostingDir, { recursive: true })
await copyFile(path.join(rootDir, '.openai', 'hosting.json'), path.join(hostingDir, 'hosting.json'))

await writeFile(
  path.join(serverDir, 'index.js'),
  `const assets = ${JSON.stringify(assets)};

function decodeBase64(value) {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getAsset(pathname) {
  const normalizedPath = pathname.endsWith('/') ? '/index.html' : pathname;
  return assets[normalizedPath] || assets['/index.html'];
}

export async function fetch(request) {
  const url = new URL(request.url);
  const asset = getAsset(url.pathname);
  const headers = new Headers({
    'Content-Type': asset.mimeType,
  });

  if (url.pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return new Response(decodeBase64(asset.body), { headers });
}

export default { fetch };

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  const { createServer } = await import('node:http');
  const port = Number(process.env.PORT || 3000);

  createServer(async (req, res) => {
    const response = await fetch(new Request(new URL(req.url || '/', \`http://localhost:\${port}\`)));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port, () => {
    console.log(\`Server listening on http://localhost:\${port}\`);
  });
}
`,
)
