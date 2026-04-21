interface Code {
  id: string
  scan_count: number
  created_at: string
  qrDataUrl?: string
}

interface Props {
  code: Code
  onDelete: (id: string) => void
  onSave: (id: string) => void
}

export default function CodeCard({ code, onDelete, onSave }: Props) {
  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 14, background: '#fff' }}>
      <div style={{ width: 56, height: 56, background: '#f5f5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {code.qrDataUrl
          ? <img src={code.qrDataUrl} alt="活码" style={{ width: 52, height: 52 }} />
          : <span style={{ fontSize: 24 }}>▦</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 'bold', fontSize: 14 }}>活码 {code.id}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
          已扫描 {code.scan_count} 次 · {new Date(code.created_at).toLocaleDateString('zh-CN')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onSave(code.id)} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
          💾 保存图片
        </button>
        <button onClick={() => onDelete(code.id)} style={{ background: '#fce4ec', color: '#c62828', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
          删除
        </button>
      </div>
    </div>
  )
}
