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
  // Pre-select everyone who isn't already a member
  const [checked, setChecked] = useState<Set<string>>(
    new Set(contributors.filter((c) => !c.alreadyMember).map((c) => c.email)),
  );
  const [importing, setImporting] = useState(false);

  const newContributors = contributors.filter((c) => !c.alreadyMember);
  const alreadyMembers = contributors.filter((c) => c.alreadyMember);

  function toggle(email: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === newContributors.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(newContributors.map((c) => c.email)));
    }
  }

  async function handleConfirm() {
    const selected = contributors.filter((c) => !c.alreadyMember && checked.has(c.email));
    if (selected.length === 0) { onClose(); return; }
    setImporting(true);
    try {
      await onConfirm(selected);
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
              {newContributors.map((c) => (
                <li key={c.email} className={styles.item}>
                  <label className={styles.itemLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={checked.has(c.email)}
                      onChange={() => toggle(c.email)}
                    />
                    <div className={styles.avatar}>{c.name.charAt(0).toUpperCase()}</div>
                    <div className={styles.info}>
                      <span className={styles.name}>{c.name}</span>
                      <span className={styles.email}>{c.email}</span>
                      {c.githubUsername && (
                        <span className={styles.github}>@{c.githubUsername}</span>
                      )}
                    </div>
                    {c.possibleDuplicate && (
                      <span className={styles.warnBadge} title={`May match existing member "${c.possibleDuplicate}"`}>
                        ⚠ possible duplicate
                      </span>
                    )}
                  </label>
                </li>
              ))}
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
