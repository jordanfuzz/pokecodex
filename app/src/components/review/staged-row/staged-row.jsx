import { useState } from 'react'
import axios from 'axios'
import './staged-row.scss'

const EDITABLE_TYPES = [
  'npc-trade', 'side-game', 'special', 'starter', 'prize', 'gift',
  'pokewalker', 'fossil', 'honey-tree', 'event', 'game-corner', 'static-default',
]

const StagedRow = ({ row, selected, onToggleSelected, onAction }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: row.name ?? '',
    description: row.description ?? '',
    source: row.source ?? 'special',
    gen: row.gen,
  })

  const patch = async () => {
    try {
      await axios.patch(`/api/staged-sources/${row.id}`, {
        name: draft.name,
        description: draft.description,
        source: draft.source,
        gen: Number(draft.gen),
      })
      setIsEditing(false)
      await onAction()
    } catch (error) {
      console.error('Failed to save staged row', error)
    }
  }

  const approve = async (body) => {
    try {
      await axios.post(`/api/staged-sources/${row.id}/approve`, body ?? {})
      await onAction()
    } catch (error) {
      console.error('Failed to approve staged row', error)
    }
  }

  const reject = async () => {
    try {
      await axios.post(`/api/staged-sources/${row.id}/reject`)
      await onAction()
    } catch (error) {
      console.error('Failed to reject staged row', error)
    }
  }

  const isPending = row.status === 'pending'

  return (
    <div className={`staged-row kind-${row.rowKind} status-${row.status}`}>
      <div className="staged-row-header">
        {isPending && row.rowKind === 'new' && (
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
        )}
        <span className={`kind-badge kind-${row.rowKind}`}>{row.rowKind}</span>
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
            <button onClick={patch}>Save</button>
            <button onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        ) : (
          <div className="staged-fields">
            <span className="staged-name">{row.name}</span>
            <span className="staged-type">{row.source}</span>
            <span className="staged-desc">{row.description}</span>
            {isPending && <button onClick={() => setIsEditing(true)}>Edit</button>}
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

      {isPending && row.rowKind === 'new' && !row.suggestedSourceId && (
        <div className="row-actions">
          <button className="approve-button" onClick={() => approve()}>Approve</button>
          <button className="reject-button" onClick={reject}>Reject</button>
        </div>
      )}
    </div>
  )
}

export default StagedRow
