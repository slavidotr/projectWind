import { useState, useEffect, useRef, useMemo } from 'react'
import { newId, WGER_CATEGORIES, WGER_LANG } from '../utils'
import { useLang } from '../i18n'

const API_BASE = 'https://wger.de/api/v2/exerciseinfo/?format=json&limit=100'
const PER_PAGE = 12

function stripHtml(html) {
  return html ? html.replace(/<[^>]+>/g, '').trim() : ''
}

function getTranslation(item, langId) {
  if (!item?.translations?.length) return null
  // prefer UI language, then English (2), then any
  return (
    item.translations.find(tr => tr.language === langId) ||
    item.translations.find(tr => tr.language === 2) ||
    item.translations.find(tr => tr.name) ||
    item.translations[0]
  )
}

function normalize(item, langId) {
  const tr   = getTranslation(item, langId)
  const name = tr?.name?.trim() || `Exercise ${item.id}`
  const desc = stripHtml(tr?.description || '')
  const cat  = WGER_CATEGORIES[item.category?.id] || item.category?.name || 'General'
  const img  = item.images?.find(i => i.is_main)?.image || item.images?.[0]?.image || null
  return { id: item.id, name, desc, cat, img }
}

const ALL_CAT = '__all__'

export default function ExerciseLibrary({ currentWorkout, onAddExercise }) {
  const { t, lang } = useLang()
  const langId = WGER_LANG[lang] ?? 2

  const [rawAll,    setRawAll]    = useState([])   // raw API items for re-normalize on lang change
  const [loading,   setLoading]   = useState(true)
  const [loadMore,  setLoadMore]  = useState(false)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [catFilter, setCatFilter] = useState(ALL_CAT)
  const [page,      setPage]      = useState(0)
  const [open,      setOpen]      = useState({})
  const [added,     setAdded]     = useState({})
  const searchRef = useRef()
  const abortRef  = useRef(null)

  useEffect(() => {
    setRawAll([])
    setLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    async function load() {
      try {
        let url = API_BASE
        let first = true
        while (url) {
          const res = await fetch(url, { signal: ctrl.signal })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          const items = json.results || []
          setRawAll(prev => [...prev, ...items])
          if (first) { setLoading(false); first = false }
          if (json.next) setLoadMore(true)
          else setLoadMore(false)
          url = json.next
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          setError(t('library.error'))
          setLoading(false)
        }
      }
    }
    load()
    return () => ctrl.abort()
  }, [])

  // re-normalize when lang changes
  const all = useMemo(
    () => rawAll
      .map(item => normalize(item, langId))
      .filter(e => e.name && !e.name.startsWith('Exercise '))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [rawAll, langId]
  )

  const categories = Object.values(WGER_CATEGORIES)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter(e => {
      const matchCat = catFilter === ALL_CAT || e.cat === catFilter
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.cat.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [all, catFilter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageSafe  = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(pageSafe * PER_PAGE, (pageSafe + 1) * PER_PAGE)

  useEffect(() => { setPage(0) }, [search, catFilter])

  function addToPlan(ex) {
    if (!currentWorkout) { window.alert(t('library.noWorkout')); return }
    onAddExercise({ id: newId(), name: ex.name, category: ex.cat, wgerId: ex.id, sets: 3, reps: '8-10', weight: 0, unit: 'kg', notes: '' })
    setAdded(a => ({ ...a, [ex.id]: true }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="library-toolbar">
        <div className="search-wrap" style={{ flex: 1 }}>
          <input ref={searchRef} className="input" placeholder={t('library.search')} value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <span className="library-count" style={{ flexShrink: 0 }}>
          {loadMore
            ? `${all.length}+`
            : t('library.count', { n: filtered.length })}
        </span>
      </div>

      {/* Category chips */}
      <div className="lib-cat-chips">
        <button
          className={`lib-cat-chip ${catFilter === ALL_CAT ? 'active' : ''}`}
          onClick={() => setCatFilter(ALL_CAT)}
        >
          {t('library.all')}
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`lib-cat-chip ${catFilter === cat ? 'active' : ''}`}
            onClick={() => setCatFilter(cat)}
          >
            {t(`library.cat.${cat}`)}
          </button>
        ))}
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
                      <div className="lib-card-cat">{t(`library.cat.${ex.cat}`) !== `library.cat.${ex.cat}` ? t(`library.cat.${ex.cat}`) : ex.cat}</div>
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
                      {ex.img  && <img className="lib-card-img" src={ex.img} alt={ex.name} loading="lazy" />}
                    </>
                  )}
                </div>
              )
            })}
            {loadMore && (
              <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--fg2)', fontSize: 13 }}>
                {t('library.loadingMore')}
              </div>
            )}
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
