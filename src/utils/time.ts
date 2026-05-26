const ensureDate = (input: string | Date): Date => {
  if (input instanceof Date) return input;
  if (!input) return new Date();
  const normalized = input.replace(' ', 'T');
  if (!normalized.includes('T') && !normalized.includes(':')) {
    const [year, month, day] = input.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const normalizeLocale = (lang: string) => {
  return lang?.replace('_', '-') || 'en-US';
};

function addPanguSpace(text: string): string {
  return text
    .replace(/([\u4e00-\u9fa5])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
}

export function formatMonthDay(dateInput: string | Date, lang: string = 'zh-CN'): string {
  const date = ensureDate(dateInput);
  const formatted = new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
  }).format(date);

  return lang.toLowerCase().startsWith('zh') ? addPanguSpace(formatted) : formatted;
}

export function formatFullDate(dateInput: string | Date, lang: string = 'zh-CN'): string {
  const date = ensureDate(dateInput);
  const formatted = new Intl.DateTimeFormat(normalizeLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);

  return lang.toLowerCase().startsWith('zh') ? addPanguSpace(formatted) : formatted;
}

export function formatDateTime(dateInput: string | Date, lang: string = 'zh-CN'): string {
  const date = ensureDate(dateInput);
  const formatted = new Intl.DateTimeFormat(normalizeLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return lang.toLowerCase().startsWith('zh') ? addPanguSpace(formatted) : formatted;
}
