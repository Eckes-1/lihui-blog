import { marked } from 'marked';

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }: { text: string }) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
});

export function parseMarkdown(content: string): string {
  if (!content) return '';
  const result = marked.parse(content);
  return typeof result === 'string' ? result : '';
}

export async function renderMarkdown(content: string): Promise<string> {
  return marked(content || '');
}

export function extractHeadings(html: string): { depth: number; text: string; slug: string }[] {
  const headings: { depth: number; text: string; slug: string }[] = [];
  const regex = /<h([1-4])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const depth = parseInt(match[1]);
    const text = match[2].replace(/<[^>]*>/g, '');
    const slug = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
    headings.push({ depth, text, slug });
  }
  return headings;
}

export function calculateReadingTime(content: string): { words: number; minutes: number } {
  const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = content.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length;
  const words = chineseChars + englishWords;
  const minutes = Math.max(1, Math.ceil(words / 300));
  return { words, minutes };
}

export function validateMarkdown(content: string): string[] {
  const warnings: string[] = [];

  const fenceMatches = content.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    warnings.push('codeFence');
  }

  const lines = content.split('\n');
  let inFence = false;
  let backtickCount = 0;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      for (const ch of line) {
        if (ch === '`') backtickCount++;
      }
    }
  }
  if (backtickCount % 2 !== 0) {
    warnings.push('inlineCode');
  }

  return warnings;
}
