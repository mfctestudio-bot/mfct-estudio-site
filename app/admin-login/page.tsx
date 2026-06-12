'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

function LoginForm() {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/admin'

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario.trim() || !senha.trim()) return
    setLoading(true); setErro('')
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    })
    if (res.ok) {
      router.push(redirect)
      router.refresh()
    } else {
      setErro('Usuário ou senha incorretos.')
      setLoading(false)
    }
  }

  return (
    <div className="admin-zone" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Image src="/logo.png" alt="MFCT Estúdio" width={120} height={79} style={{ objectFit: 'contain', height: 56, width: 'auto', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text2)' }}>
            ADMIN
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, letterSpacing: '1px' }}>Acesso restrito — MFCT Estúdio</div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '2rem' }}>
          <form onSubmit={entrar}>
            <label style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Usuário</label>
            <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)}
              placeholder="usuário" autoFocus autoComplete="username"
              style={{ width: '100%', background: 'var(--bg2)', border: `1px solid ${erro ? 'var(--accent2)' : 'var(--border)'}`, borderRadius: 6, padding: '12px 14px', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
            <label style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              style={{ width: '100%', background: 'var(--bg2)', border: `1px solid ${erro ? 'var(--accent2)' : 'var(--border)'}`, borderRadius: 6, padding: '12px 14px', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 12, letterSpacing: '2px' }} />
            {erro && <div style={{ fontSize: 12, color: 'var(--accent2)', marginBottom: 12 }}>{erro}</div>}
            <button type="submit" disabled={loading || !senha || !usuario}
              style={{ width: '100%', background: 'var(--accent2)', color: '#fff', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: "'Anton', sans-serif", textTransform: 'uppercase', letterSpacing: 1, opacity: (loading || !senha || !usuario) ? 0.6 : 1 }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <a href="/" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>← Voltar ao site</a>
        </div>
      </div>
    </div>
  )
}

export default function AdminLogin() {
  return <Suspense><LoginForm /></Suspense>
}
