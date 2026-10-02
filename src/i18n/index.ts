import en from './en.json';

export type MessageKey = keyof typeof en;

const messages: Record<string, string> = en;

/** Looks up a UI string and fills `{placeholders}`. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = messages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}
