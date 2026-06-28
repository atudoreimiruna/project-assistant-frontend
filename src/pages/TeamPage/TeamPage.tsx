import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  teamsApi,
  type Team,
  type TeamReport,
  type ActivityLog,
  type Student,
  type ContributorPreview,
} from '../../api/teams';
import { ContributorsPreviewModal } from '../../components/ContributorsPreviewModal/ContributorsPreviewModal';
import { coursesApi, type Course } from '../../api/courses';
import { ApiError } from '../../api/client';
import styles from './TeamPage.module.css';

/* ─── Helpers ──────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/* ─── Activity Chart (SVG) ─────────────────────────────── */

function ActivityChart({ logs }: { logs: ActivityLog[] }) {
  const DAYS = 30;
  const W = 600;
  const H = 120;
  const PAD = { top: 10, right: 10, bottom: 24, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const buckets: Record<string, number> = {};
  for (let i = DAYS - 1; i >= 0; i--) {
    const key = daysAgo(i).toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  for (const log of logs) {
    const key = new Date(log.timestamp).toISOString().slice(0, 10);
    if (key in buckets) buckets[key]++;
  }

  const entries = Object.entries(buckets);
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);
  const barW = innerW / DAYS;
  const gap = barW * 0.25;
  const labelIndices = [0, 7, 14, 21, 29];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} aria-label="Activity over last 30 days">
      {[0, 0.5, 1].map((frac) => {
        const y = PAD.top + innerH - frac * innerH;
        return (
          <g key={frac}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {Math.round(frac * maxCount)}
            </text>
          </g>
        );
      })}
      {entries.map(([date, count], i) => {
        const barH = (count / maxCount) * innerH;
        const x = PAD.left + i * barW + gap / 2;
        const y = PAD.top + innerH - barH;
        return (
          <rect key={date} x={x} y={y} width={barW - gap} height={barH} rx={2}
            fill="#6D9773" opacity={count === 0 ? 0.2 : 0.85}>
            <title>{`${date}: ${count} event${count !== 1 ? 's' : ''}`}</title>
          </rect>
        );
      })}
      {labelIndices.map((i) => {
        const [date] = entries[i] ?? [];
        if (!date) return null;
        const x = PAD.left + i * barW + barW / 2;
        const label = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">{label}</text>;
      })}
    </svg>
  );
}

/* ─── Integrations Panel ───────────────────────────────── */

interface IntegrationsPanelProps {
  team: Team;
  onUpdated: (team: Team) => void;
  onSyncGithub: () => Promise<void>;
  onSyncDrive: () => Promise<void>;
  isSyncing: boolean;
}

function IntegrationsPanel({ team, onUpdated, onSyncGithub, onSyncDrive, isSyncing }: IntegrationsPanelProps) {
  const [githubInput, setGithubInput] = useState(team.githubRepo ?? '');
  const [driveInput, setDriveInput] = useState(team.googleDriveFolder ?? '');
  const [githubStatus, setGithubStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');
  const [driveStatus, setDriveStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');
  const [driveMsg, setDriveMsg] = useState('');

  async function saveGithub() {
    setGithubStatus('saving');
    try {
      const updated = await teamsApi.update(team._id, { githubRepo: githubInput.trim() || undefined });
      onUpdated(updated);
      setGithubStatus('ok');
      // Auto-sync contributors if repo is set
      if (githubInput.trim()) {
        await onSyncGithub();
      }
      setTimeout(() => setGithubStatus('idle'), 2500);
    } catch {
      setGithubStatus('err');
      setTimeout(() => setGithubStatus('idle'), 3000);
    }
  }

  async function saveDrive() {
    setDriveStatus('saving');
    setDriveMsg('');
    try {
      const updated = await teamsApi.update(team._id, { googleDriveFolder: driveInput.trim() || undefined });
      onUpdated(updated);
      if (driveInput.trim()) {
        try { await teamsApi.syncDrive(team._id); } catch { /* silent */ }
        await onSyncDrive();
      }
      setDriveStatus('ok');
      setTimeout(() => { setDriveStatus('idle'); setDriveMsg(''); }, 3500);
    } catch {
      setDriveStatus('err');
      setTimeout(() => setDriveStatus('idle'), 3000);
    }
  }

  const githubChanged = githubInput !== (team.githubRepo ?? '');
  const driveChanged = driveInput !== (team.googleDriveFolder ?? '');

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Integrations</h2>

      {/* GitHub */}
      <div className={styles.integrationCard}>
        <div className={styles.integrationHeader}>
          <svg className={styles.integrationIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className={styles.integrationName}>GitHub Repository</span>
          {team.githubRepo && (
            <span className={styles.integrationConnected}>Connected</span>
          )}
        </div>
        <p className={styles.integrationHint}>
          Repository contributors will be imported automatically as team members on save.
        </p>
        <div className={styles.integrationRow}>
          <input
            className={styles.integrationInput}
            type="url"
            placeholder="https://github.com/owner/repo"
            value={githubInput}
            onChange={(e) => setGithubInput(e.target.value)}
          />
          <button
            className={`${styles.integrationBtn} ${githubStatus === 'ok' ? styles.integrationBtnOk : githubStatus === 'err' ? styles.integrationBtnErr : ''}`}
            onClick={saveGithub}
            disabled={githubStatus === 'saving' || isSyncing || !githubChanged}
          >
            {githubStatus === 'saving' || isSyncing
              ? 'Saving…'
              : githubStatus === 'ok'
              ? '✓ Saved & Synced'
              : githubStatus === 'err'
              ? 'Error'
              : 'Save & Sync'}
          </button>
        </div>
        {team.githubRepo && !githubChanged && (
          <div className={styles.integrationLinked}>
            <a href={team.githubRepo} target="_blank" rel="noopener noreferrer">{team.githubRepo}</a>
            <button
              className={styles.reSyncBtn}
              onClick={onSyncGithub}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing…' : '↻ Re-sync members'}
            </button>
          </div>
        )}
      </div>

      {/* Google Drive */}
      <div className={styles.integrationCard}>
        <div className={styles.integrationHeader}>
          <svg className={styles.integrationIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4.433 22.396l2.266-3.924H22.4l-2.267 3.924H4.433zM8.566 15.547L2.133 4.037 4.4.113l6.433 11.51-2.267 3.924zm5.668 0l-2.267-3.924L18.4.113l2.267 3.924-6.433 11.51z" />
          </svg>
          <span className={styles.integrationName}>Google Drive Folder</span>
          {team.googleDriveFolder && (
            <span className={styles.integrationConnected}>Connected</span>
          )}
        </div>
        <p className={styles.integrationHint}>
          Users with access to the Drive folder will be imported automatically as team members on save.
        </p>
        <div className={styles.integrationRow}>
          <input
            className={styles.integrationInput}
            type="url"
            placeholder="https://drive.google.com/drive/folders/..."
            value={driveInput}
            onChange={(e) => setDriveInput(e.target.value)}
          />
          <button
            className={`${styles.integrationBtn} ${driveStatus === 'ok' ? styles.integrationBtnOk : driveStatus === 'err' ? styles.integrationBtnErr : ''}`}
            onClick={saveDrive}
            disabled={driveStatus === 'saving' || !driveChanged}
          >
            {driveStatus === 'saving'
              ? 'Saving…'
              : driveStatus === 'ok'
              ? '✓ Saved'
              : driveStatus === 'err'
              ? 'Error'
              : 'Save & Sync'}
          </button>
        </div>
        {driveMsg && <p className={styles.integrationMsg}>{driveMsg}</p>}
        {team.googleDriveFolder && !driveChanged && (
          <div className={styles.integrationLinked}>
            <a href={team.googleDriveFolder} target="_blank" rel="noopener noreferrer">
              {team.googleDriveFolder.replace('https://drive.google.com/drive/folders/', 'Drive folder: ')}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Members Section ──────────────────────────────────── */

type SortKey = 'commits' | 'prs' | 'contributionScore' | 'name';

interface EnrichedStudent extends Student {
  commits: number;
  prs: number;
  contributionScore: number;
}

interface MembersSectionProps {
  students: Student[];
  report: TeamReport | null;
  teamId: string;
  onMembersChanged: () => void;
}

function MembersSection({ students, report, teamId, onMembersChanged }: MembersSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>('contributionScore');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addGithub, setAddGithub] = useState('');
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'err'>('idle');
  const [addErr, setAddErr] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Merge students with report breakdown by email
  const enriched: EnrichedStudent[] = students.map((s) => {
    const bd = report?.studentBreakdown.find((b) => b.email === s.email);
    return {
      ...s,
      commits: bd?.commits ?? 0,
      prs: bd?.prs ?? 0,
      contributionScore: bd?.contributionScore ?? 0,
    };
  });

  const sorted = [...enriched].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    return b[sortKey] - a[sortKey];
  });

  const maxScore = Math.max(...enriched.map((s) => s.contributionScore), 1);
  const hasStats = enriched.some((s) => s.contributionScore > 0 || s.commits > 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) return;
    setAddStatus('saving');
    setAddErr('');
    try {
      await teamsApi.addStudent(teamId, {
        name: addName.trim(),
        email: addEmail.trim(),
        githubUsername: addGithub.trim() || undefined,
      });
      setAddName('');
      setAddEmail('');
      setAddGithub('');
      setShowAddForm(false);
      onMembersChanged();
    } catch (err) {
      setAddErr(err instanceof ApiError ? err.message : 'Failed to add member.');
      setAddStatus('err');
    } finally {
      setAddStatus('idle');
    }
  }

  async function handleRemove(student: Student) {
    if (!confirm(`Remove ${student.name} from this team?`)) return;
    setRemovingId(student._id);
    try {
      await teamsApi.removeStudent(teamId, student._id);
      onMembersChanged();
    } catch {
      // surface error silently — member stays in list
    } finally {
      setRemovingId(null);
    }
  }

  const sortCols: { key: SortKey; label: string }[] = hasStats
    ? [
        { key: 'contributionScore', label: 'Score' },
        { key: 'commits', label: 'Commits' },
        { key: 'prs', label: 'PRs' },
        { key: 'name', label: 'Name' },
      ]
    : [{ key: 'name', label: 'Name' }];

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <h2 className={styles.sectionTitle}>
          Team Members
          <span className={styles.sectionBadge}>{students.length}</span>
        </h2>
        <button
          className={styles.addMemberToggle}
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? '✕ Cancel' : '+ Add member'}
        </button>
      </div>

      {/* Add member form */}
      {showAddForm && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <div className={styles.addFormRow}>
            <input
              className={styles.addInput}
              placeholder="Full name *"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
            />
            <input
              className={styles.addInput}
              type="email"
              placeholder="Email *"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              required
            />
            <input
              className={styles.addInput}
              placeholder="GitHub username (optional)"
              value={addGithub}
              onChange={(e) => setAddGithub(e.target.value)}
            />
            <button
              type="submit"
              className={styles.addSubmitBtn}
              disabled={addStatus === 'saving'}
            >
              {addStatus === 'saving' ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addErr && <p className={styles.addErr}>{addErr}</p>}
        </form>
      )}

      {/* Sort controls */}
      {hasStats && (
        <div className={styles.tableSortRow}>
          <span className={styles.tableSortLabel}>Sort by</span>
          {sortCols.map((c) => (
            <button
              key={c.key}
              className={`${styles.sortBtn} ${sortKey === c.key ? styles.sortActive : ''}`}
              onClick={() => setSortKey(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {students.length === 0 && !showAddForm && (
        <p className={styles.emptyText}>No members yet. Add one above or link a GitHub repo / Google Drive folder.</p>
      )}

      {/* Members table */}
      {sorted.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {hasStats && <th className={styles.th}>#</th>}
                <th className={styles.th}>Member</th>
                {hasStats && (
                  <>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Commits</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>PRs</th>
                    <th className={styles.th}>Contribution</th>
                  </>
                )}
                <th className={styles.th} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s._id} className={`${styles.tr} ${hasStats && i === 0 ? styles.trTop : ''}`}>
                  {hasStats && (
                    <td className={styles.tdRank}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                  )}
                  <td className={styles.td}>
                    <div className={styles.memberCell}>
                      <div className={styles.memberAvatar}>{s.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className={styles.memberName}>{s.name}</div>
                        <div className={styles.memberEmail}>{s.email}</div>
                        {s.githubUsername && (
                          <a
                            href={`https://github.com/${s.githubUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.memberGithub}
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{s.githubUsername}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  {hasStats && (
                    <>
                      <td className={styles.tdNum}>{s.commits}</td>
                      <td className={styles.tdNum}>{s.prs}</td>
                      <td className={styles.tdScore}>
                        <div className={styles.scoreRow}>
                          <div className={styles.scoreBar}>
                            <div
                              className={styles.scoreFill}
                              style={{ width: `${(s.contributionScore / maxScore) * 100}%` }}
                            />
                          </div>
                          <span className={styles.scoreNum}>{s.contributionScore}</span>
                        </div>
                      </td>
                    </>
                  )}
                  <td className={styles.tdAction}>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemove(s)}
                      disabled={removingId === s._id}
                      title="Remove member"
                      aria-label={`Remove ${s.name}`}
                    >
                      {removingId === s._id ? '…' : '✕'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ─── Milestones ───────────────────────────────────────── */

function MilestonesList({ milestones }: { milestones: Team['milestones'] }) {
  if (milestones.length === 0) {
    return <p className={styles.emptyText}>No milestones defined.</p>;
  }

  const sorted = [...milestones].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );

  return (
    <ul className={styles.milestoneList}>
      {sorted.map((m) => {
        const overdue = !m.completed && new Date(m.dueDate) < new Date();
        return (
          <li
            key={m._id}
            className={`${styles.milestoneItem} ${m.completed ? styles.milestoneComplete : overdue ? styles.milestoneOverdue : ''}`}
          >
            <div className={styles.milestoneCheck}>{m.completed ? '✓' : overdue ? '!' : '○'}</div>
            <div className={styles.milestoneBody}>
              <div className={styles.milestoneTitle}>{m.title}</div>
              {m.description && <div className={styles.milestoneDesc}>{m.description}</div>}
              <div className={styles.milestoneMeta}>
                Due {fmtDate(m.dueDate)}
                {m.completed && <span className={styles.completedTag}>Completed</span>}
                {overdue && <span className={styles.overdueTag}>Overdue</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Status Badge ─────────────────────────────────────── */

const STATUS_LABEL = { ON_TRACK: 'On Track', AT_RISK: 'At Risk', BLOCKED: 'Blocked' } as const;
const STATUS_MOD = {
  ON_TRACK: styles.statusOnTrack,
  AT_RISK: styles.statusAtRisk,
  BLOCKED: styles.statusBlocked,
} as const;

function StatusBadge({ status }: { status: TeamReport['status'] }) {
  return (
    <span className={`${styles.statusBadge} ${STATUS_MOD[status]}`}>
      <span className={styles.statusDot} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ─── Main Page ────────────────────────────────────────── */

export function TeamPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { teacher, logout } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [report, setReport] = useState<TeamReport | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [contributorsModal, setContributorsModal] = useState<{
    source: 'github' | 'drive';
    contributors: ContributorPreview[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const t = await teamsApi.getById(id);
      setTeam(t);

      const [reportResult, activityResult, courseResult] = await Promise.allSettled([
        teamsApi.getReport(id),
        teamsApi.getActivity(id),
        coursesApi.getById(t.courseId),
      ]);

      if (reportResult.status === 'fulfilled') setReport(reportResult.value);
      if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
      if (courseResult.status === 'fulfilled') setCourse(courseResult.value);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load team.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Lightweight reload of just the team (members list) without full spinner
  const reloadTeam = useCallback(async () => {
    if (!id) return;
    try {
      const t = await teamsApi.getById(id);
      setTeam(t);
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteTeam() {
    if (!team || !confirm(`Delete "${team.name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await teamsApi.delete(team._id);
      navigate(course ? `/courses/${course._id}` : '/dashboard');
    } catch {
      setError('Failed to delete team.');
      setIsDeleting(false);
    }
  }

  async function handleSyncGithub() {
    if (!id) return;
    setIsSyncing(true);
    try {
      await teamsApi.syncGithub(id);
      await reloadTeam();
      // Show contributor selection modal
      const previews = await teamsApi.previewContributors(id, 'github');
      if (previews.length > 0) setContributorsModal({ source: 'github', contributors: previews });
    } catch {
      // errors surfaced in IntegrationsPanel
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSyncDriveAndPreview() {
    if (!id) return;
    try {
      const previews = await teamsApi.previewContributors(id, 'drive');
      if (previews.length > 0) setContributorsModal({ source: 'drive', contributors: previews });
    } catch {
      // silent
    }
  }

  async function handleImportConfirm(selected: ContributorPreview[]) {
    if (!id) return;
    await teamsApi.importContributors(id, selected);
    setContributorsModal(null);
    await reloadTeam();
  }

  const totalCommits = report?.studentBreakdown.reduce((s, m) => s + m.commits, 0) ?? 0;
  const totalPRs = report?.studentBreakdown.reduce((s, m) => s + m.prs, 0) ?? 0;
  const completedMilestones = (team?.milestones ?? []).filter((m) => m.completed).length;
  const totalMilestones = team?.milestones.length ?? 0;

  return (
    <div className={styles.page}>
      {/* Nav */}
      <header className={styles.nav}>
        <div className={styles.navBrand}>
          <div className={styles.logoIcon}>TL</div>
          <span className={styles.logoText}>TeamLens</span>
        </div>
        <div className={styles.navRight}>
          <span className={styles.teacherName}>{teacher?.name}</span>
          <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <button className={styles.breadcrumbBack} onClick={() => navigate('/dashboard')}>
            My Courses
          </button>
          <span className={styles.breadcrumbSep}>›</span>
          {course && (
            <>
              <button className={styles.breadcrumbBack} onClick={() => navigate(`/courses/${course._id}`)}>
                {course.title}
              </button>
              <span className={styles.breadcrumbSep}>›</span>
            </>
          )}
          {team && <span className={styles.breadcrumbCurrent}>{team.name}</span>}
        </nav>

        {isLoading && (
          <div className={styles.stateWrap}>
            <div className={styles.spinner} />
            <p className={styles.stateText}>Loading team…</p>
          </div>
        )}

        {!isLoading && error && <div className={styles.errorBox}>{error}</div>}

        {!isLoading && !error && team && (
          <>
            {/* ── Header ── */}
            <div className={styles.pageHeader}>
              <div className={styles.headerLeft} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className={styles.teamInitial}>{team.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className={styles.teamNameRow}>
                    <h1 className={styles.teamName}>{team.name}</h1>
                    {report && <StatusBadge status={report.status} />}
                  </div>
                  {team.githubRepo ? (
                    <a href={team.githubRepo} target="_blank" rel="noopener noreferrer" className={styles.repoLink}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      {team.githubRepo.replace('https://github.com/', '')}
                    </a>
                  ) : (
                    <span className={styles.noRepo}>No repository linked</span>
                  )}
                </div>
              </div>
              <button
                className={styles.deleteTeamBtn}
                onClick={handleDeleteTeam}
                disabled={isDeleting}
                title="Delete team"
              >
                {isDeleting ? 'Deleting…' : 'Delete team'}
              </button>
            </div>

            {/* ── Stats row ── */}
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{team.students.length}</span>
                <span className={styles.statLabel}>Members</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{totalCommits}</span>
                <span className={styles.statLabel}>Commits</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{totalPRs}</span>
                <span className={styles.statLabel}>Pull Requests</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{activity.length}</span>
                <span className={styles.statLabel}>Activity Events</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {totalMilestones > 0 ? `${completedMilestones}/${totalMilestones}` : '—'}
                </span>
                <span className={styles.statLabel}>Milestones</span>
              </div>
            </div>

            {/* ── Two-col layout ── */}
            <div className={styles.grid}>
              {/* Left column */}
              <div className={styles.col}>
                {/* Members */}
                <MembersSection
                  students={team.students}
                  report={report}
                  teamId={team._id}
                  onMembersChanged={reloadTeam}
                />

                {/* Activity Chart */}
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Activity (last 30 days)</h2>
                  {activity.length > 0 ? (
                    <ActivityChart logs={activity} />
                  ) : (
                    <p className={styles.emptyText}>No activity logged yet.</p>
                  )}
                </section>
              </div>

              {/* Right column */}
              <div className={styles.col}>
                {/* Integrations */}
                <IntegrationsPanel
                  team={team}
                  onUpdated={setTeam}
                  onSyncGithub={handleSyncGithub}
                  onSyncDrive={handleSyncDriveAndPreview}
                  isSyncing={isSyncing}
                />

                {/* AI Report */}
                {report && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                      AI Report
                      <span className={styles.reportAge}>
                        {new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </h2>
                    {report.summary && <p className={styles.summary}>{report.summary}</p>}
                    {report.concerns.length > 0 && (
                      <div className={styles.concerns}>
                        <div className={styles.concernsTitle}>⚠ Concerns</div>
                        <ul className={styles.bulletList}>
                          {report.concerns.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                    {report.recommendations.length > 0 && (
                      <div className={styles.recommendations}>
                        <div className={styles.recsTitle}>💡 Recommendations</div>
                        <ul className={styles.bulletList}>
                          {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </section>
                )}

                {/* Milestones */}
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    Milestones
                    {totalMilestones > 0 && (
                      <span className={styles.sectionBadge}>{completedMilestones}/{totalMilestones}</span>
                    )}
                  </h2>
                  {totalMilestones > 0 && (
                    <div className={styles.milestoneMacroBar}>
                      <div
                        className={styles.milestoneMacroFill}
                        style={{ width: `${(completedMilestones / totalMilestones) * 100}%` }}
                      />
                    </div>
                  )}
                  <MilestonesList milestones={team.milestones} />
                </section>

                {/* Details */}
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Details</h2>
                  <dl className={styles.metaList}>
                    <dt>Created</dt>
                    <dd>{fmtDate(team.createdAt)}</dd>
                    <dt>Last updated</dt>
                    <dd>{fmtDate(team.updatedAt)}</dd>
                  </dl>
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      {contributorsModal && (
        <ContributorsPreviewModal
          source={contributorsModal.source}
          contributors={contributorsModal.contributors}
          onConfirm={handleImportConfirm}
          onClose={() => setContributorsModal(null)}
        />
      )}
    </div>
  );
}
