import { visit } from 'unist-util-visit';

let compiler = null
try {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { NodeCompiler } = await import('@myriaddreamin/typst-ts-node-compiler')
    compiler = NodeCompiler.create()
  }
} catch {}

export function remarkTypst() {
  return async (tree) => {
    if (!compiler) return

    const instances = []
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'typst') {
        instances.push({ node, index, parent })
      }
    })

    for (const { node, index, parent } of instances) {
      try {
        const title = node.meta ? node.meta.trim() : ''
        const formattedTitle = title.replace(/\*(.*?)\*/g, '<em>$1</em>')
        const svg = await compiler.svg({ mainFileContent: node.value })
        parent.children[index] = {
          type: 'html',
          value: `<div class="typst-render">${svg}<div class="typst-title">${formattedTitle}</div></div>`,
        }
      } catch {}
    }
  }
}
