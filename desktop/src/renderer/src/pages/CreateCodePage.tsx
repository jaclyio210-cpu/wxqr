import { useState, useRef } from 'react'
import QRCode from 'qrcode'
import { createCode } from '../api'

interface Props {
  onCreated: () => void
}

function ImageUploadBox({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    onFile(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{ flex: 1, border: '2px dashed #1976d2', borderRadius: 10, padding: 16, textAlign: 'center', background: '#f8fbff', cursor: 'pointer', minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
      {preview
        ? <img src={preview} alt={label} style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 8 }} />
        : <span style={{ fontSize: 28, marginBottom: 6 }}>📷</span>
      }
      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1976d2' }}>{label}</div>
      {!file && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>点击选择图片</div>}
      {file && <div style={{ fontSize: 11, color: '#4caf50', marginTop: 4 }}>✓ {file.name}</div>}
    </div>
  )
}

export default function CreateCodePage({ onCreated }: Props) {
  const [qr1File, setQr1File] = useState<File | null>(null)
  const [qr2File, setQr2File] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ id: string; qrDataUrl: string; scan_url: string } | null>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!qr1File || !qr2File) { setError('请先上传两个微信号的二维码图片'); return }
    setGenerating(true)
    setError('')
    try {
      const data = await createCode(qr1File, qr2File)
      const qrDataUrl = await QRCode.toDataURL(data.scan_url, { width: 256, margin: 2 })
      setResult({ id: data.id, qrDataUrl, scan_url: data.scan_url })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败，请检查网络和 API 配置')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    const res = await globalThis.electronAPI.saveImage(result.qrDataUrl, `活码-${result.id}.png`)
    if (res.success) alert(`活码图片已保存到:\n${res.path}`)
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>上传两个微信号的二维码图片，第1位扫到微信号1，第2位扫到微信号2，循环交替</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <ImageUploadBox label="微信号 1" file={qr1File} onFile={setQr1File} />
        <ImageUploadBox label="微信号 2" file={qr2File} onFile={setQr2File} />
      </div>

      {error && <p style={{ color: '#c62828', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {!result && (
        <button
          onClick={handleGenerate}
          disabled={generating || !qr1File || !qr2File}
          style={{ width: '100%', padding: '11px', background: generating ? '#90caf9' : '#1976d2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
        >
          {generating ? '生成中...' : '⚡ 生成活码'}
        </button>
      )}

      {result && (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 20, textAlign: 'center', background: '#f9f9f9' }}>
          <img src={result.qrDataUrl} alt="活码" style={{ width: 180, height: 180 }} />
          <p style={{ fontSize: 12, color: '#888', margin: '8px 0 16px' }}>将此图片发给客户扫描即可</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={handleSave} style={{ padding: '8px 20px', background: '#43a047', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              💾 保存图片到本地
            </button>
            <button onClick={onCreated} style={{ padding: '8px 20px', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              返回列表
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
