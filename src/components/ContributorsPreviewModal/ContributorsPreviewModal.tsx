import { useState } from 'react';
import { type ContributorPreview } from '../../api/teams';
import styles from './ContributorsPreviewModal.module.css';

interface Props {
  source: 'github' | 'drive';
  contributors: ContributorPreview[];
  onConfirm: (selected: ContributorPreview[]) => Promise<void>;
  onClose: () => void;
}

export function ContributorsPreviewModal({ source, contributors, onConfirm, onClose }: Props) {
  const newContributors = contributors.filter((c) => !c.alreadyMember);
  const alreadyMembers = contributors.filter((c) => c.alreadyMember);

  // Keyed by GitHub username (falling back to email) rather than email alone,
  // since a flagged placeholder email can be edited in place before import —
  // keying on the very value that's being edited would break selection.
  const keyFor = (c: ContributorPreview) => c.githubUsername ?? c.email;

  // Pre-select everyone who isn't already a member
  const [checked, setChecked] = useState<Set<string>>(
    new Set(newContributors.map(keyFor)),
  );
  // Emails the professor edited in place, keyed the same way. Only populated
  // for rows actually changed — everything else keeps its original c.email.
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === newContributors.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(newContributors.map(keyFor)));
    }
  }

  function emailFor(c: ContributorPreview): string {
    return emailEdits[keyFor(c)] ?? c.email;
  }

  async function handleConfirm() {
    const selected = newContributors
      .filter((c) => checked.has(keyFor(c)))
      .map((c) => ({ ...c, email: emailFor(c).trim() }));
    if (selected.length === 0) { onClose(); return; }
    setImporting(true);
    setImportError('');
    try {
      await onConfirm(selected);
    } catch {
      // Without this the rejection escapes the click handler and the modal
      // just sits there with no explanation.
      setImportError('Could not add the selected members. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  const sourceLabel = source === 'github' ? 'GitHub' : 'Google Drive';
  const allChecked = newContributors.length > 0 && checked.size === newContributors.length;
  const selectedCount = checked.size;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="contrib-title">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title} id="contrib-title">
              Import from {sourceLabel}
            </h2>
            <p className={styles.subtitle}>
              {contributors.length} contributor{contributors.length !== 1 ? 's' : ''} found
              {alreadyMembers.length > 0 && ` · ${alreadyMembers.length} already on team`}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* New contributors */}
        {newContributors.length > 0 ? (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>New contributors</span>
              <button className={styles.toggleAll} onClick={toggleAll}>
                {allChecked ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <ul className={styles.list}>
              {newContributors.map((c) => {
                const key = keyFor(c);
                const flagged = !c.hasRealEmail;
                return (
                  <li key={key} className={styles.item}>
                    <label className={styles.itemLabel}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={checked.has(key)}
                        onChange={() => toggle(key)}
                      />
                      <div className={styles.avatar}>{c.name.charAt(0).toUpperCase()}</div>
                      <div className={styles.info}>
                        <span className={styles.name}>{c.name}</span>
                        {flagged ? (
                          <input
                            type="email"
                            className={styles.emailInput}
                            value={emailFor(c)}
                            placeholder="Enter a real email address"
                            onChange={(e) =>
                              setEmailEdits((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          />
                        ) : (
                          <span className={styles.email}>{c.email}</span>
                        )}
                        {c.githubUsername && (
                          <span className={styles.github}>@{c.githubUsername}</span>
                        )}
                      </div>
                      {flagged && (
                        <span
                          className={styles.warnBadge}
                          title="GitHub doesn't expose a public email for this account — please verify or enter a real one"
                        >
                          ⚠ no public email
                        </span>
                      )}
                      {c.possibleDuplicate && (
                        <span className={styles.warnBadge} title={`May match existing member "${c.possibleDuplicate}"`}>
                          ⚠ possible duplicate
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className={styles.emptyNew}>
            All contributors are already team members.
          </div>
        )}

        {/* Already members (collapsed) */}
        {alreadyMembers.length > 0 && (
          <details className={styles.alreadySection}>
            <summary className={styles.alreadySummary}>
              {alreadyMembers.length} already on team
            </summary>
            <ul className={styles.list}>
              {alreadyMembers.map((c) => (
                <li key={c.email} className={`${styles.item} ${styles.itemMuted}`}>
                  <div className={`${styles.avatar} ${styles.avatarMuted}`}>{c.name.charAt(0).toUpperCase()}</div>
                  <div className={styles.info}>
                    <span className={styles.name}>{c.name}</span>
                    <span className={styles.email}>{c.email}</span>
                  </div>
                  <span className={styles.memberBadge}>member</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Footer */}
        {importError && <p className={styles.importError}>{importError}</p>}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={importing || (newContributors.length > 0 && selectedCount === 0)}
          >
            {importing
              ? 'Adding…'
              : selectedCount === 0
              ? 'Skip'
              : `Add ${selectedCount} member${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
