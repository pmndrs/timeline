#!/usr/bin/env node
import { Application, ReflectionKind } from 'typedoc'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

async function main() {
  const app = await Application.bootstrap({
    entryPoints: [
      join(repoRoot, 'packages/timeline/src/index.ts'),
      join(repoRoot, 'packages/timeline/src/ease.ts'),
      join(repoRoot, 'packages/timeline/src/transition.ts'),
      join(repoRoot, 'packages/timeline/src/graph.ts'),
      join(repoRoot, 'packages/timeline/src/look-at.ts'),
      join(repoRoot, 'packages/timeline/src/offset.ts'),
      join(repoRoot, 'packages/timeline/src/misc.ts'),
      join(repoRoot, 'packages/react/src/index.ts'),
    ],
    exclude: ['**/utils.ts', '**/previous.ts'],
    excludeExternals: true,
    excludePrivate: true,
    excludeProtected: true,
    excludeNotDocumented: true,
    categorizeByGroup: false,
    sort: ['alphabetical'],
    tsconfig: join(repoRoot, 'tsconfig.json'),
  })

  const project = await app.convert()
  if (!project) {
    console.error('TypeDoc conversion failed')
    process.exit(1)
  }

  const reflections = project.getReflectionsByKind
    ? project.getReflectionsByKind(ReflectionKind.Function)
    : []

  const untilSet = new Set(['timePassed', 'mediaFinished', 'animationFinished', 'forever', 'promiseConcat'])
  const structuralSet = new Set(['action', 'parallel', 'start', 'abortable', 'graph', 'doUntil', 'doWhile'])

  const categories = {
    'Action Update Ease': [],
    'Action Update': [],
    'Action Until': [],
    Structural: [],
    Misc: [],
  }

  for (const refl of reflections) {
    const name = refl.name
    const sourceFile = refl.sources?.[0]?.fileName ?? ''
    if (/utils\.ts$/.test(sourceFile) || /previous\.ts$/.test(sourceFile)) continue

    let category = 'Misc'
    const srcLower = sourceFile.toLowerCase()
    if (srcLower.includes('ease.ts')) category = 'Action Update Ease'
    else if (srcLower.includes('transition.ts') || srcLower.includes('look-at.ts') || srcLower.includes('offset.ts'))
      category = 'Action Update'
    else if (untilSet.has(name)) category = 'Action Until'
    else if (srcLower.includes('index.ts') || srcLower.includes('graph.ts') || structuralSet.has(name))
      category = 'Structural'

    const sig = refl.signatures?.[0]
    const comment = sig?.comment || refl.comment
    const summary = comment?.summary?.map((p) => p.text).join('').trim() || ''

    const params = sig?.parameters ?? []
    const returns = sig?.type?.toString?.() || sig?.type?.name || ''

    const parts = []
    parts.push(`### ${name}`)
    if (summary) parts.push(summary)
    if (params.length) {
      parts.push('#### Parameters')
      for (const p of params) {
        const pType = p.type?.toString?.() || p.type?.name || ''
        const pText = p.comment?.summary?.map((x) => x.text).join('').trim() || ''
        const line = '- \\\`' + p.name + '\\\` (' + pType + ')' + (pText ? ': ' + pText : '')
        parts.push(line)
      }
    }
    if (returns) {
      parts.push('#### Returns')
      parts.push('`' + returns + '`')
    }
    categories[category].push({ name, body: parts.join('\n') })
  }

  const docParts = []
  docParts.push('---')
  docParts.push('title: Overview of All Functions.')
  docParts.push('description: Overview of function categories (action update, action until, action update ease)')
  docParts.push('nav: 3')
  docParts.push('---\n')
  const order = ['Action Update Ease', 'Action Update', 'Action Until', 'Structural', 'Misc']
  for (const section of order) {
    const items = categories[section]
    if (!items || items.length === 0) continue
    docParts.push(`## ${section}`)
    for (const it of items.sort((a, b) => a.name.localeCompare(b.name))) {
      docParts.push('')
      docParts.push(it.body)
    }
    docParts.push('')
  }

  const outPath = join(repoRoot, 'docs/getting-started/3-overview.mdx')
  fs.mkdirSync(dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, docParts.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


