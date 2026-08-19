import { useState } from 'react'
import axios from 'axios'
import { fieldDiffs } from '../review.logic'
import './staged-row.scss'

const EDITABLE_TYPES = [
  'npc-trade', 'side-game', 'special', 'starter', 'prize', 'gift',
  'pokewalker', 'fossil', 'honey-tree', 'event', 'game-corner', 'static-default',
]

const StagedRow = ({ row, selected, onToggleSelected, onAction }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)

  const startEdit = () => {
    setDraft({
      name: row.name ?? '',
      description: row.description ?? '',
      source: row.source ?? 'special',
      gen: row.gen,
    })
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setDraft(null)
  }

  const draftGen = draft ? parseInt(draft.gen, 10) : NaN
  const draftValid =
    !!draft &&
    draft.name.trim().length > 0 &&
    Number.isInteger(draftGen) &&
    draftGen >= 1 &&
    draftGen <= 9

  const patch = async () => {
    if (!draftValid) return
    setBusy(true)
    try {
      await axios.patch(`/api/staged-sources/${row.id}`, {
        name: draft.name,
        description: draft.description,
        source: draft.source,
        gen: draftGen,
      })
      setIsEditing(false)
      setDraft(null)
      await onAction()
    } catch (error) {
      console.error('Failed to save staged row', error)
    } finally {
      setBusy(false)
    }
  }

  const approve = async (body) => {
    setBusy(true)
    try {
      await axios.post(`/api/staged-sources/${row.id}/approve`, body ?? {})
      await onAction()
    } catch (error) {
      console.error('Failed to approve staged row', error)
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    setBusy(true)
    try {
      await axios.post(`/api/staged-sources/${row.id}/reject`)
      await onAction()
    } catch (error) {
      console.error('Failed to reject staged row', error)
    } finally {
      setBusy(false)
    }
  }

  const resolvePairing = async (confirm) => {
    setBusy(true)
    try {
      await axios.post(`/api/staged-sources/${row.id}/pairing`, { confirm })
      await onAction()
    } catch (error) {
      console.error('Failed to resolve pairing suggestion', error)
    } finally {
      setBusy(false)
    }
  }

  const guardedDelete = async () => {
    setBusy(true)
    try {
      await axios.post(`/api/staged-sources/${row.id}/approve`, { action: 'delete' })
      await onAction()
    } catch (error) {
      const { status, data } = error.response ?? {}
      if (status !== 409) {
        console.error('Failed to delete staged row', error)
      } else {
        const confirmed = window.confirm(
          `${data.referenceCount} user tracking row(s) reference this source. Delete it and the tracking rows?`
        )
        if (confirmed) {
          try {
            await axios.post(`/api/staged-sources/${row.id}/approve`, {
              action: 'delete',
              confirmReferencedDelete: true,
            })
            await onAction()
          } catch (confirmedError) {
            console.error('Failed to delete staged row', confirmedError)
          }
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const isPending = row.status === 'pending'

  return (
    <div className={`staged-row kind-${row.rowKind} status-${row.status}`}>
      <div className="staged-row-header">
        {isPending && row.rowKind === 'new' && (
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
        )}
        <span className={`kind-badge badge-kind-${row.rowKind}`}>{row.rowKind}</span>
        {row.confidence && (
          <span className={`confidence-chip confidence-${row.confidence}`}>{row.confidence}</span>
        )}
        {row.expectedAbsent && <span className="expected-chip">expected absent</span>}
        {!isPending && <span className="resolution-chip">{row.status}: {row.resolution}</span>}
      </div>

      {row.rowKind !== 'existing-unmatched' &&
        (isEditing ? (
          <div className="staged-fields-edit">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
              {EDITABLE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              type="number"
              value={draft.gen}
              onChange={(e) => setDraft({ ...draft, gen: e.target.value })}
            />
            <button type="button" onClick={patch} disabled={busy || !draftValid}>Save</button>
            <button type="button" onClick={cancelEdit} disabled={busy}>Cancel</button>
          </div>
        ) : (
          <div className="staged-fields">
            <span className="staged-name">{row.name}</span>
            <span className="staged-type">{row.source}</span>
            <span className="staged-desc">{row.description}</span>
            {isPending && <button type="button" onClick={startEdit} disabled={busy}>Edit</button>}
          </div>
        ))}

      {row.rawSnippet && row.rowKind !== 'existing-unmatched' && (
        <details className="provenance">
          <summary>
            {row.origin} — {row.pageTitle} (rev {row.revid}) — {row.games?.join(', ')}
          </summary>
          <pre className="raw-snippet">{row.rawSnippet}</pre>
        </details>
      )}

      {isPending && row.suggestedSourceId && row.suggestedSource && (
        <div className="pairing-banner">
          Suggested match ({row.suggestionReason}): <strong>{row.suggestedSource.name}</strong>
          {' — '}{row.suggestedSource.description ?? 'no description'} (gen {row.suggestedSource.gen})
          <button type="button" onClick={() => resolvePairing(true)} disabled={busy}>Same source</button>
          <button type="button" onClick={() => resolvePairing(false)} disabled={busy}>Not a match</button>
        </div>
      )}

      {row.rowKind === 'audit' && row.matchedSource && (
        <table className="audit-diff">
          <tbody>
            {fieldDiffs(row).map(({ field, staged, existing, changed }) => (
              <tr key={field} className={changed ? 'changed' : ''}>
                <td className="diff-field">{field}</td>
                <td className="diff-existing">{String(existing ?? '—')}</td>
                <td className="diff-staged">{String(staged ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {row.rowKind === 'existing-unmatched' && row.matchedSource && (
        <div className="existing-summary">
          <span className="staged-name">{row.matchedSource.name}</span>
          <span className="staged-type">{row.matchedSource.source}</span>
          <span className="staged-desc">{row.matchedSource.description}</span>
          <span className="reference-count">{row.referenceCount} user reference(s)</span>
        </div>
      )}

      {isPending && (
        <div className="row-actions">
          {row.rowKind === 'new' && !row.suggestedSourceId && (
            <>
              <button type="button" className="approve-button" onClick={() => approve()} disabled={busy}>Approve</button>
              <button type="button" className="reject-button" onClick={reject} disabled={busy}>Reject</button>
            </>
          )}
          {row.rowKind === 'audit' && (
            <>
              <button type="button" onClick={() => approve({ action: 'no-change' })} disabled={busy}>Existing is fine</button>
              <button type="button" onClick={() => approve({ action: 'apply' })} disabled={busy}>Apply parsed changes</button>
              <button type="button" className="reject-button" onClick={reject} disabled={busy}>Reject</button>
            </>
          )}
          {row.rowKind === 'existing-unmatched' && (
            <>
              <button type="button" onClick={() => approve({ action: 'keep' })} disabled={busy}>Keep</button>
              <button type="button" className="delete-button" onClick={guardedDelete} disabled={busy}>Delete</button>
              <button type="button" className="reject-button" onClick={reject} disabled={busy}>Skip</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default StagedRow
