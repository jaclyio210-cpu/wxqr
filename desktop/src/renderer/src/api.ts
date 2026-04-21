async function getApiUrl(): Promise<string> {
  const config = await (globalThis as any).electronAPI.getConfig()
  return config.apiUrl
}

export async function createCode(qr1File: File, qr2File: File): Promise<{ id: string; scan_url: string }> {
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const [qr1, qr2] = await Promise.all([toBase64(qr1File), toBase64(qr2File)])
  const apiUrl = await getApiUrl()

  const res = await fetch(`${apiUrl}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qr1, qr2 }),
  })
  if (!res.ok) throw new Error(`创建失败: HTTP ${res.status}`)
  return res.json()
}

export async function listCodes(): Promise<Array<{ id: string; scan_count: number; created_at: string }>> {
  const apiUrl = await getApiUrl()
  const res = await fetch(`${apiUrl}/codes`)
  if (!res.ok) throw new Error(`获取列表失败: HTTP ${res.status}`)
  return res.json()
}

export async function deleteCode(id: string): Promise<void> {
  const apiUrl = await getApiUrl()
  const res = await fetch(`${apiUrl}/codes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除失败: HTTP ${res.status}`)
}
