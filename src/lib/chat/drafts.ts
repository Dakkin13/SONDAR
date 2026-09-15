// Per-conversation composer drafts, so a half-typed message survives
// navigating away and back. localStorage is fine: drafts are device-local.

function key(conversationKey: string) {
  return `chat_draft_${conversationKey}`
}

export function getDraft(conversationKey: string): string {
  try {
    return localStorage.getItem(key(conversationKey)) ?? ''
  } catch {
    return ''
  }
}

export function setDraft(conversationKey: string, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(key(conversationKey), text)
    else localStorage.removeItem(key(conversationKey))
  } catch {
    /* storage unavailable (private mode, quota) — drafts are best-effort */
  }
}
