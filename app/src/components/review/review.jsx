import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Navigate } from 'react-router'
import StagedRow from './staged-row/staged-row'
import { pendingCountsByGen, groupByPokemon, buildListQuery } from './review.logic'
import './review.scss'

const GENS = [1, 2, 3, 4, 5, 6, 7]
const DEFAULT_FILTERS = { status: 'pending', rowKind: null, confidence: null, includeExpected: false }

const Review = () => {
  const [userData, setUserData] = useState(null)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [summary, setSummary] = useState([])
  const [gen, setGen] = useState(1)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [rows, setRows] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [error, setError] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/login', { withCredentials: true })
        if (response?.data?.id && response?.data?.isAdmin) setUserData(response.data)
        else setShouldRedirect(true)
      } catch (error) {
        setShouldRedirect(true)
      }
    }
    checkAuth()
  }, [])

  const loadSummary = useCallback(async () => {
    try {
      const response = await axios.get('/api/staged-sources/summary')
      setSummary(response.data.summary)
      setError(null)
    } catch (error) {
      console.error('Failed to load review data', error)
      setError('Failed to load review data')
    }
  }, [])

  const loadRows = useCallback(async () => {
    try {
      const response = await axios.get(`/api/staged-sources?${buildListQuery(gen, filters)}`)
      setRows(response.data.stagedSources)
      setSelectedIds(new Set())
      setError(null)
    } catch (error) {
      console.error('Failed to load review data', error)
      setError('Failed to load review data')
    }
  }, [gen, filters])

  useEffect(() => {
    if (!userData?.id) return
    loadSummary()
  }, [userData, loadSummary])

  useEffect(() => {
    if (!userData?.id) return
    loadRows()
  }, [userData, loadRows])

  const refresh = useCallback(async () => {
    await Promise.all([loadRows(), loadSummary()])
  }, [loadRows, loadSummary])

  const toggleSelected = id => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableIds = rows
    .filter(row => row.rowKind === 'new' && row.status === 'pending' && !row.suggestedSourceId)
    .map(row => row.id)

  const selectedSelectable = selectableIds.filter(id => selectedIds.has(id))

  const handleBulkApprove = async () => {
    try {
      await axios.post('/api/staged-sources/bulk-approve', { ids: selectedSelectable })
      await refresh()
      setError(null)
    } catch (error) {
      console.error('Failed to load review data', error)
      setError('Bulk approve failed')
    }
  }

  const pendingCounts = pendingCountsByGen(summary, filters.includeExpected)
  const groups = groupByPokemon(rows)

  return shouldRedirect ? (
    <Navigate to="/login" replace />
  ) : (
    <div className="review-container">
      <h1 className="review-header">Source review</h1>
      {error && <p className="review-error">{error}</p>}
      <div className="gen-tabs">
        {GENS.map(g => (
          <button
            type="button"
            key={g}
            className={`gen-tab ${g === gen ? 'active' : ''}`}
            aria-current={g === gen ? 'true' : undefined}
            onClick={() => setGen(g)}
          >
            Gen {g} ({pendingCounts.get(g) ?? 0})
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <select
          value={filters.rowKind ?? ''}
          onChange={e => setFilters(f => ({ ...f, rowKind: e.target.value || null }))}
        >
          <option value="">All kinds</option>
          <option value="new">New</option>
          <option value="audit">Audit</option>
          <option value="existing-unmatched">Existing unmatched</option>
        </select>
        <select
          value={filters.confidence ?? ''}
          onChange={e => setFilters(f => ({ ...f, confidence: e.target.value || null }))}
        >
          <option value="">All confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <label className="expected-toggle">
          <input
            type="checkbox"
            checked={filters.includeExpected}
            onChange={e => setFilters(f => ({ ...f, includeExpected: e.target.checked }))}
          />
          Show expected-absent
        </label>
      </div>
      {selectableIds.length > 0 && (
        <div className="bulk-bar">
          <label>
            <input
              type="checkbox"
              checked={selectedSelectable.length === selectableIds.length && selectableIds.length > 0}
              onChange={e =>
                setSelectedIds(e.target.checked ? new Set(selectableIds) : new Set())
              }
            />
            Select all new rows in view ({selectableIds.length})
          </label>
          <button
            type="button"
            className="bulk-approve-button"
            disabled={selectedSelectable.length === 0}
            onClick={handleBulkApprove}
          >
            Approve selected ({selectedSelectable.length})
          </button>
        </div>
      )}
      {groups.map(group => (
        <div className="pokemon-group" key={`${group.pokemonId}-${group.rows[0].id}`}>
          <h2 className="pokemon-group-header">
            #{group.pokemonId} {group.pokemonName}
          </h2>
          {group.rows.map(row => (
            <StagedRow
              key={row.id}
              row={row}
              selected={selectedIds.has(row.id)}
              onToggleSelected={() => toggleSelected(row.id)}
              onAction={refresh}
            />
          ))}
        </div>
      ))}
      {rows.length === 0 && <p className="empty-message">Nothing to review with these filters.</p>}
    </div>
  )
}

export default Review
