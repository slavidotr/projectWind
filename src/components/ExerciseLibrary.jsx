import { useState, useEffect, useRef } from 'react'
import { newId, WGER_CATEGORIES } from '../utils'
import { useLang } from '../i18n'

const API = 'https://wger.de/api/v2/exerciseinfo/?language=2&format=json&limit=100'
const PER_PAGE = 12

function stripHtml(html) {
  return html ? html.replace(/<[^>]+>/g, '').trim() : ''
}

function getTranslation(item) {
  if (!item?.translations?.length) return null
  return item.translations.find(tr => tr.language === 2) || item.translations[0]
}

function normalize(item) {
  const tr   = getTranslation(item)
  const name = tr?.name || item.name || `Exercise ${item.id}`
  const desc = stripHtml(tr?.description || '')
  const cat  = WGER_CATEGORIES[item.category?.id] || item.category?.name || 'General'
  const img  = item.images?.find(i => i.is_main)?.image || item.images?.[0]?.image || null
  return { id: item.id, name, desc, cat, img }
}

export default function ExerciseLibrary({ currentWorkout, onAddExercise }) {
  const { t } = useLang()
  const [all,     setAll]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(0)
  const [open,    setOpen]    = useState({})
  const [added,   setAdded]   = useState({})
  const searchRef = useRef()

  useEffect(() => {
    async function load() {
      try {
        const items = []
        let url = API
        while (url) {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          items.push(...(json.results || []))
          url = json.next
        }
        setAll(items.sort((a, b) => {
          const na = getTranslation(a)?.name || ''
          const nb = getTranslation(b)?.name || ''
          return na.localeCompare(nb, undefined, { sensitivity: 'base' })
        }).map(normalize))
      } catch (e) {
        setError(t('library.error'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = search.trim()
    ? all.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.cat.toLowerCase().includes(search.toLowerCase()))
    : all

  const pageCount  = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageSafe   = Math.min(page, pageCount - 1)
  const pageItems  = filtered.slice(pageSafe * PER_PAGE, (pageSafe + 1) * PER_PAGE)

  useEffect(() => { setPage(0) }, [search])

  function addToPlan(ex) {
    if (!currentWorkout) { window.alert(t('library.noWorkout')); return }
    onAddExercise({ id: newId(), name: ex.name, category: ex.cat, wgerId: ex.id, sets: 3, reps: '8-10', weight: 0, unit: 'kg', notes: '' })
    setAdded(a => ({ ...a, [ex.id]: true }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="library-toolbar">
        <div className="search-wrap" style={{ flex: 1 }}>
          <input ref={searchRef} className="input" placeholder={t('library.search')} value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <span className="library-count" style={{ flexShrink: 0 }}>{t('library.count', { n: filtered.length })}</span>
      </div>

      {loading ? (
        <div className="empty"><p>{t('library.loading')}</p><div className="splash-spinner" /></div>
      ) : error ? (
        <div className="empty"><p style={{ color: 'var(--danger)' }}>{error}</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty"><p>{t('library.noResults')}</p></div>
      ) : (
        <>
          <div className="library-body">
            {pageItems.map(ex => {
              const isOpen = open[ex.id]
              return (
                <div key={ex.id} className="lib-card">
                  <div className="lib-card-header" onClick={() => setOpen(o => ({ ...o, [ex.id]: !o[ex.id] }))}>
                    <div style={{ flex: 1 }}>
                      <div className="lib-card-title">{ex.name}</div>
                      <div className="lib-card-cat">{ex.cat}</div>
                    </div>
                    <button
                      className={`btn btn-sm ${added[ex.id] ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={e => { e.stopPropagation(); addToPlan(ex) }}
                      disabled={added[ex.id]}
                    >
                      {added[ex.id] ? t('library.added') : t('library.addToPlan')}
                    </button>
                  </div>
                  {isOpen && (
                    <>
                      {ex.desc && <div className="lib-card-desc">{ex.desc}</div>}
                      {ex.img  && <img className="lib-card-img" src={ex.img} alt={ex.name} />}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="library-pagination">
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={pageSafe === 0}>{t('library.prev')}</button>
            <span style={{ fontSize: 13, color: 'var(--fg2)' }}>{t('library.page', { n: pageSafe + 1, total: pageCount })}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(p + 1, pageCount - 1))} disabled={pageSafe >= pageCount - 1}>{t('library.next')}</button>
          </div>
        </>
      )}
    </div>
  )
}
