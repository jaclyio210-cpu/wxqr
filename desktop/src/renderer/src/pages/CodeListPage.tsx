import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import CodeCard from '../components/CodeCard'
import { listCodes, deleteCode } from '../api'

interface CodeItem {
  id: string
  scan_count: number
  created_at: string
  qrDataUrl?: string
  scan_url?: string
}

export default function CodeListPage() {
  const [codes, setCodes] = useState<CodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCodes = async () => {
    setLoading(true)
    setError('')
    try {
      const config = await globalThis.electronAPI.getConfig()
      const raw = await listCodes()
      const withQr = await Promise.all(raw.map(async c => {
        const scanUrl = `${config.apiUrl}/scan/${c.id}`
        const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 200, margin: 1 })
        return { ...c, qrDataUrl, scan_url: scanUrl }
      }))
      setCodes(withQr)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCodes() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm(`确认删除活码 ${id}？删除后无法恢复。`)) return
    try {
      await deleteCode(id)
      setCodes(prev => prev.filter(c => c.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const handleSave = async (id: string) => {
    const code = codes.find(c => c.id === id)
    if (!code?.qrDataUrl) return
    const result = await globalThis.electronAPI.saveImage(code.qrDataUrl, `活码-${id}.png`)
    if (result.success) alert(`已保存到: ${result.path}`)
  }

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>加载中...</div>
  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <p style={{ color: '#c62828' }}>{error}</p>
      <button onClick={loadCodes} style={{ padding: '8px 20px', cursor: 'pointer' }}>重试</button>
    </div>
  )
  if (codes.length === 0) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>
      <p>还没有活码，点击右上角"新建活码"开始</p>
    </div>
  )

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {codes.map(code => (
        <CodeCard key={code.id} code={code} onDelete={handleDelete} onSave={handleSave} />
      ))}
    </div>
  )
}
