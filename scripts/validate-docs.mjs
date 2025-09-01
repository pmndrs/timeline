#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

async function main() {
  const repoRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
  // 1) Regenerate overview
  execSync('node scripts/generate-overview.mjs', { stdio: 'inherit', cwd: repoRoot })

  // 2) Compile all mdx files using local @mdx-js/mdx
  const { compile } = await import('@mdx-js/mdx')
  const docsDir = path.join(repoRoot, 'docs')
  const files = []
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f)
      const s = fs.statSync(p)
      if (s.isDirectory()) walk(p)
      else if (p.endsWith('.mdx')) files.push(p)
    }
  }
  walk(docsDir)

  let ok = true
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    try {
      await compile(src)
      console.log('OK', path.relative(repoRoot, f))
    } catch (e) {
      ok = false
      console.error('ERR', path.relative(repoRoot, f), String(e.message).replace(/\n/g, ' '))
    }
  }
  if (!ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


