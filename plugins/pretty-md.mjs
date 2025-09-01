import fs from 'fs'
import { dirname, join, resolve } from 'path'
import { Converter } from 'typedoc'
import { MarkdownPageEvent, MarkdownRendererEvent } from 'typedoc-plugin-markdown'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const kindsToExclude = [
  1, //"Project"
  2, //"Module"
  4, //"Namespace"
  8388608, //"Document"
]

export const load = (app) => {
  app.converter.on(Converter.EVENT_RESOLVE_END, (whatami) => {
    // Happens before the MarkdownPageEvents
  })

  app.renderer.markdownHooks.on('page.begin', (page) => {
    let deprecatedTag = undefined
    if (page.page?.model?.comment) {
      deprecatedTag = page.page.model.comment.blockTags.find((t) => t.tag === '@deprecated')
    } else if (page.page?.model?.signatures) {
      deprecatedTag = page.page.model.signatures[0].comment?.blockTags.find((t) => t.tag === '@deprecated')
    }
    if (deprecatedTag) {
      return `> [!CAUTION]\n> Deprecated: ${deprecatedTag.content.reduce((p, x) => p + x.text, '')}\n\n`
    }
    return
  })

  app.renderer.on(MarkdownPageEvent.BEGIN, (page) => {
    // Skip unwanted kinds
    if (kindsToExclude.includes(page.model.kind)) {
      page.project.removeReflection(page.model)
      return
    }

    page.frontmatter = {
      title: page.model.name,
      nav: 0, // placeholder, will be set later. Defines the sorting order in the sidebar
      sourcecode: page?.model?.sources?.[0]?.fileName ?? '',
    }
  })

  // Fill excluded pages with empty content
  app.renderer.on(MarkdownPageEvent.END, (page) => {
    if (kindsToExclude.includes(page.model.kind)) {
      page.contents = ''
      return
    }

    // Remove the default Defined in tag as we replace it with a custom one in the frontmatter
    page.contents = page.contents.replace(/Defined in:.*\n\n/g, '')
    // Remove the default Deprecated tag as we replace it with a custom one
    page.contents = page.contents.replace(/## Deprecated\n\n?.*\n?/g, '')
    // Replace tags marked as args with props, as props is a more common term
    page.contents = page.contents.replace(/## args\n\n/g, '## props\n\n')
    // Replace types that return a promise and react component with a code block so that mdx will parse
    page.contents = page.contents.replace(/(Promise<.*>)/g, '`$1`')
    // Replace Parameters with props for components
    page.contents = page.contents.replace(/## Parameters\n\n### props/g, '## props\n---')
    // Replace parameters with proper styling
    page.contents = page.contents.replace(
      /#### `(.*)` - (.*)/g,
      '<span style={{fontSize: 24, color: "rgb(var(--color-primary))"}}>**$1**</span>\n\n$2\n',
    )
    // Shrink headers that should be smaller, and tweak the color
    // page.contents = page.contents.replace(/####? (.*)\n/g, '**$1**\n')
    // NOTE: This here is another option for the above, tweaks the param color and size
    page.contents = page.contents.replace(
      /####? (.*)\n/g,
      '<span style={{fontSize: 24, color: "rgb(var(--color-primary))"}}>**$1**</span>\n',
    )
    // Add a divider after Returns
    page.contents = page.contents.replace(/## Returns\n\n/g, '## Returns\n---\n')
  })

  // Happens after the markdown pages are generated
  app.renderer.on(MarkdownRendererEvent.END, (page) => {
    const docsPath = resolve(__dirname, '../docs')
    const modulesPath = join(docsPath, 'modules')
    const readmePath = join(docsPath, 'README.md')
    const functionsPath = join(docsPath, 'functions')
    const variablesPath = join(docsPath, 'variables')
    const typesPath = join(docsPath, 'types')
    const apiPath = join(docsPath, 'API')
    const overviewPath = join(docsPath, 'getting-started/3-overview.mdx')

    // Clear out the previous instance of the API folder
    if (fs.existsSync(apiPath)) {
      fs.rmSync(apiPath, { recursive: true, force: true })
    }

    // Delete the modules folder if it exists. These are kind of useless for how our API is structured
    if (fs.existsSync(modulesPath)) {
      fs.rmSync(modulesPath, { recursive: true, force: true })
    }

    // Delete the README.md file if it exists
    if (fs.existsSync(readmePath)) {
      fs.unlinkSync(readmePath)
    }

    // Generate the new API folder
    if (!fs.existsSync(apiPath)) {
      fs.mkdirSync(apiPath, { recursive: true })
    }

    const moveFiles = (sourceDir) => {
      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir)
        files.forEach((file) => {
          const sourceFile = join(sourceDir, file)
          const targetFile = join(apiPath, file)
          fs.renameSync(sourceFile, targetFile)
        })
      }
    }

    // Move all the files we want to keep to the API folder
    moveFiles(functionsPath)
    moveFiles(variablesPath)
    moveFiles(typesPath)

    // Sort the files in the API folder alphabetically and update the nav number in the frontmatter
    const sortFilesAndUpdateNav = (sourceDir) => {
      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir)
        const functionQualifiedFiles = files.map((file) => {
          return {
            symbolName: file.slice(file.indexOf('.') + 1, file.lastIndexOf('.')),
            fileName: file,
          }
        })
        functionQualifiedFiles.sort((a, b) => a.symbolName.localeCompare(b.symbolName))
        functionQualifiedFiles.forEach((file, index) => {
          const targetFile = join(sourceDir, file.fileName)

          // Update the nav number in the frontmatter
          const content = fs.readFileSync(targetFile, 'utf-8')
          const updatedContent = content.replace(/nav:\s*\d+/, `nav: ${index + 25}`)
          fs.writeFileSync(targetFile, updatedContent)
        })
      }
    }

    sortFilesAndUpdateNav(apiPath)

    // Build categorized overview from function docs
    const functionFiles = fs.existsSync(apiPath)
      ? fs.readdirSync(apiPath).filter((f) => /^functions\./.test(f))
      : []

    const categories = {
      Ease: [],
      Update: [],
      Until: [],
      Structural: [],
      Misc: [],
    }

    const untilSet = new Set(['timePassed', 'mediaFinished', 'animationFinished', 'forever', 'promiseConcat'])
    const structuralSet = new Set(['action', 'parallel', 'start', 'abortable', 'graph', 'doUntil', 'doWhile'])

    for (const file of functionFiles) {
      const full = join(apiPath, file)
      const raw = fs.readFileSync(full, 'utf-8')
      const frontmatterMatch = raw.match(/^---[\s\S]*?---\n?/)
      const frontmatter = frontmatterMatch ? frontmatterMatch[0] : ''
      const body = raw.replace(frontmatter, '').trim()
      // Extract simple frontmatter fields
      let title = ''
      let sourcecode = ''
      if (frontmatter) {
        const titleMatch = frontmatter.match(/\n\s*title:\s*(.*)\n/)
        if (titleMatch) title = titleMatch[1].trim()
        const sourceMatch = frontmatter.match(/\n\s*sourcecode:\s*(.*)\n/)
        if (sourceMatch) sourcecode = sourceMatch[1].trim()
      }
      const name = title || file.replace(/^functions\.|\.(md|mdx)$/g, '')

      // Classify
      let category = 'Misc'
      const source = sourcecode.toLowerCase()
      if (source.includes('ease.ts')) category = 'Ease'
      else if (source.includes('transition.ts') || source.includes('look-at.ts') || source.includes('offset.ts'))
        category = 'Update'
      else if (untilSet.has(name)) category = 'Until'
      else if (source.includes('index.ts') || source.includes('graph.ts') || structuralSet.has(name))
        category = 'Structural'

      categories[category].push({ name, body })
    }

    // Compose overview content
    const parts = []
    parts.push('---')
    parts.push('layout: docs')
    parts.push('title: Overview')
    parts.push('---\n')
    const order = ['Ease', 'Update', 'Until', 'Structural', 'Misc']
    for (const section of order) {
      const items = categories[section]
      if (!items || items.length === 0) continue
      parts.push(`## ${section}`)
      for (const { name, body } of items.sort((a, b) => a.name.localeCompare(b.name))) {
        parts.push(`\n### ${name}`)
        parts.push(body)
      }
      parts.push('')
    }

    const overviewContent = parts.join('\n')
    // Ensure folder exists
    const overviewDir = dirname(overviewPath)
    if (!fs.existsSync(overviewDir)) {
      fs.mkdirSync(overviewDir, { recursive: true })
    }
    fs.writeFileSync(overviewPath, overviewContent)
  })
}
