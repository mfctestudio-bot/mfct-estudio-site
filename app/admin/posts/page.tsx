'use client'
import { useEffect, useState } from 'react'
import { supabase, Post } from '@/lib/supabase'

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function novo() {
    setEditId(null)
    setTitulo('')
    setConteudo('')
  }

  function editar(p: Post) {
    setEditId(p.id)
    setTitulo(p.titulo)
    setConteudo(p.conteudo)
  }

  async function salvarRascunho() {
    if (!titulo.trim() || !conteudo.trim()) return
    setSaving(true)
    if (editId) {
      await supabase.from('posts').update({ titulo, conteudo }).eq('id', editId)
    } else {
      await supabase.from('posts').insert({ titulo, conteudo, publicado: false })
    }
    setSaving(false)
    novo()
    load()
  }

  async function publicar(id: string, publicado: boolean) {
    await supabase.from('posts').update({ publicado: !publicado }).eq('id', id)
    load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este post?')) return
    await supabase.from('posts').delete().eq('id', id)
    if (editId === id) novo()
    load()
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Posts / Dicas</h1>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem', marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>
          {editId ? 'Editar post' : 'Novo post'}
        </h3>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Título</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} style={inputStyle} placeholder="Ex: 3 dicas pra não perder o treino no fim de semana" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Conteúdo</label>
          <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }} placeholder="Escreva o texto aqui. Você pode revisar antes de publicar." />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={salvarRascunho} disabled={saving || !titulo.trim() || !conteudo.trim()} style={{
            ...btnStyle, background: 'var(--accent2)', color: '#fff',
            opacity: saving || !titulo.trim() || !conteudo.trim() ? 0.6 : 1,
          }}>
            {saving ? 'Salvando...' : editId ? 'Salvar alterações' : 'Salvar rascunho'}
          </button>
          {editId && (
            <button onClick={novo} style={{ ...btnStyle, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : posts.length === 0 ? (
        <p style={{ color: 'var(--text2)' }}>Nenhum post ainda.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {posts.map(p => (
            <div key={p.id} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {p.publicado ? 'Publicado no site' : 'Rascunho'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => editar(p)} style={smallBtn('var(--text2)')}>Editar</button>
                <button onClick={() => publicar(p.id, p.publicado)} style={smallBtn(p.publicado ? 'var(--accent)' : '#3fb950')}>
                  {p.publicado ? 'Despublicar' : 'Publicar no site'}
                </button>
                <button onClick={() => excluir(p.id)} style={smallBtn('var(--accent2)')}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text2)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6, display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const btnStyle: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '11px 18px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

function smallBtn(color: string): React.CSSProperties {
  return {
    background: 'transparent', border: `1px solid ${color}`, color, borderRadius: 4,
    padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  }
}
