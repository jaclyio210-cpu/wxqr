import { useState } from 'react'

interface Props {
  onSaved: (apiUrl: string) => void
}

export default function SetupPage({ onSaved }: Props) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!url.startsWith('https://')) {
      alert('请输入完整的 https:// 地址')
      return
    }
    setSaving(true)
    await globalThis.electronAPI.setConfig({ apiUrl: url.trim() })
    setSaving(false)
    onSaved(url.trim())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '0 40px' }}>
      <h2 style={{ marginBottom: 8 }}>初始配置</h2>
      <p style={{ color: '#666', marginBottom: 24, textAlign: 'center' }}>
        请输入你部署好的腾讯云 SCF API 网关地址
      </p>
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://service-xxx.gz.apigw.tencentcs.com/release"
        style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #ccc', marginBottom: 16, boxSizing: 'border-box' }}
      />
      <button
        onClick={handleSave}
        disabled={saving || !url}
        style={{ padding: '10px 32px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
      >
        {saving ? '保存中...' : '保存并开始使用'}
      </button>
    </div>
  )
}
