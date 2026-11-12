export type SortCategory =
  | 'Documents' | 'Images' | 'Videos' | 'Audio' | 'Archives'
  | 'Code' | 'Installers' | 'Finance' | 'Study' | 'Other'

export type SortPlanItem = {
  id: string
  original: string
  category: SortCategory
  destination: string
  newName: string
  selected: boolean
}

export type ScanResult = {
  folder: string
  files: SortPlanItem[]
}

export type Status = { connected: boolean; model: string; reason?: string | null }

// The local Python server (server.py). Everything stays on this machine.
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the Sloth Sorter server. Is it running on port 8000?')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const browse = () => call<{ folder: string }>('/api/browse', {})

export const scan = (folder: string) => call<ScanResult>('/api/scan', { folder })

export const apply = (folder: string, plan: SortPlanItem[]) =>
  call<{ moved: number }>('/api/apply', { folder, files: plan })

export const undo = (folder: string) =>
  call<{ folder: string; restored: boolean }>('/api/undo', { folder })

export async function status(): Promise<Status> {
  try {
    return await call<Status>('/api/status')
  } catch {
    return { connected: false, model: 'gemma3:4b', reason: 'server-offline' }
  }
}