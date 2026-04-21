import { useState, useEffect } from 'react'
import SetupPage from './pages/SetupPage'
import CodeListPage from './pages/CodeListPage'
import CreateCodePage from './pages/CreateCodePage'

type Page = 'list' | 'create'

export default function App() {
  const [apiUrl, setApiUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page>('list')

  useEffect(() => {
    globalThis.electronAPI.getConfig().then(config => {
      setApiUrl(config.apiUrl || null)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>加载中...</div>
  if (!apiUrl) return <SetupPage onSaved={url => setApiUrl(url)} />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1976d2', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>微信活码管理</span>
        {page === 'list'
          ? <button onClick={() => setPage('create')} style={{ background: '#fff', color: '#1976d2', border: 'none', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>+ 新建活码</button>
          : <button onClick={() => setPage('list')} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>← 返回列表</button>
        }
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {page === 'list'
          ? <CodeListPage />
          : <CreateCodePage onCreated={() => setPage('list')} />
        }
      </div>
    </div>
  )
}
