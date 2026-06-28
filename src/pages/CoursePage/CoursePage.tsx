import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coursesApi, type Course } from '../../api/courses';
import { teamsApi, type Team, type TeamReport, type TeamStatus, type CreateTeamPayload, type ContributorPreview } from '../../api/teams';
import { ApiError } from '../../api/client';
import { ContributorsPreviewModal } from '../../components/ContributorsPreviewModal/ContributorsPreviewModal';
import styles from './CoursePage.module.css';

const STATUS_LABEL: Record<TeamStatus, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  BLOCKED: 'Blocked',
};

const STATUS_MOD: Record<TeamStatus, string> = {
  ON_TRACK: styles.statusOnTrack,
  AT_RISK: styles.statusAtRisk,
  BLOCKED: styles.statusBlocked,
};

const CARD_MOD: Record<TeamStatus, string> = {
  ON_TRACK: styles.cardON_TRACK,
  AT_RISK: styles.cardAT_RISK,
  BLOCKED: styles.cardBLOCKED,
};

function StatusBadge({ status }: { status: TeamStatus }) {
  return (
    <span className={`${styles.statusBadge} ${STATUS_MOD[status]}`}>
      <span className={styles.statusDot} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function MilestoneBar({ milestones }: { milestones: Team['milestones'] }) {
  const total = milestones.length;
  if (total === 0) return <span className={styles.noMilestones}>No milestones</span>;

  const completed = milestones.filter((m) => m.completed).length;
  const pct = Math.round((completed / total) * 100);
  const overdue = milestones.filter(
    (m) => !m.completed && new Date(m.dueDate) < new Date(),
  ).length;

  return (
    <div className={styles.milestoneWrap}>
      <div className={styles.milestoneTop}>
        <span className={styles.metaLabel}>Milestones</span>
        <span className={styles.milestoneCount}>
          {completed}/{total}
          {overdue > 0 && (
            <span className={styles.overdueTag}>{overdue} overdue</span>
          )}
        </span>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TeamCard({ team, report, onClick, onDelete }: { team: Team; report: TeamReport | null; onClick: () => void; onDelete: () => void }) {
  const status = report?.status;
  const lastGenerated = report?.generatedAt
    ? new Date(report.generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      className={`${styles.card} ${status ? CARD_MOD[status] : ''} ${styles.cardClickable}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className={styles.cardHeader}>
        <div className={styles.teamInitial}>{team.name.charAt(0).toUpperCase()}</div>
        <div className={styles.cardTitle}>
          <h3 className={styles.teamName}>{team.name}</h3>
          {team.githubRepo ? (
            <a
              href={team.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.repoLink}
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {team.githubRepo.replace('https://github.com/', '')}
            </a>
          ) : (
            <span className={styles.noRepo}>No repo linked</span>
          )}
        </div>
        {status ? (
          <StatusBadge status={status} />
        ) : (
          <span className={styles.noBadge}>No report</span>
        )}
      </div>

      {report?.summary && (
        <p className={styles.summary}>{report.summary}</p>
      )}

      <MilestoneBar milestones={team.milestones} />

      <div className={styles.cardFooter}>
        <div className={styles.students}>
          {team.students.slice(0, 5).map((s) => (
            <div key={s._id} className={styles.avatar} title={`${s.name} (${s.email})`}>
              {s.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {team.students.length > 5 && (
            <div className={`${styles.avatar} ${styles.avatarMore}`}>
              +{team.students.length - 5}
            </div>
          )}
          <span className={styles.studentCount}>
            {team.students.length} student{team.students.length !== 1 ? 's' : ''}
          </span>
        </div>
        {lastGenerated && (
          <span className={styles.reportAge}>Report: {lastGenerated}</span>
        )}
      </div>

      {report && report.concerns.length > 0 && (
        <details className={styles.concerns}>
          <summary className={styles.concernsSummary}>
            {report.concerns.length} concern{report.concerns.length !== 1 ? 's' : ''}
          </summary>
          <ul className={styles.concernsList}>
            {report.concerns.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.cardDangerRow}>
        <button
          className={styles.deleteTeamBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete team"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SummaryStrip({ reports }: { reports: (TeamReport | null)[] }) {
  const counts = { ON_TRACK: 0, AT_RISK: 0, BLOCKED: 0, none: 0 };
  for (const r of reports) {
    if (r?.status) counts[r.status]++;
    else counts.none++;
  }
  return (
    <div className={styles.strip}>
      <div className={`${styles.stripCard} ${styles.stripOnTrack}`}>
        <span className={styles.stripCount}>{counts.ON_TRACK}</span>
        <span className={styles.stripLabel}>On Track</span>
      </div>
      <div className={`${styles.stripCard} ${styles.stripAtRisk}`}>
        <span className={styles.stripCount}>{counts.AT_RISK}</span>
        <span className={styles.stripLabel}>At Risk</span>
      </div>
      <div className={`${styles.stripCard} ${styles.stripBlocked}`}>
        <span className={styles.stripCount}>{counts.BLOCKED}</span>
        <span className={styles.stripLabel}>Blocked</span>
      </div>
      {counts.none > 0 && (
        <div className={`${styles.stripCard} ${styles.stripNone}`}>
          <span className={styles.stripCount}>{counts.none}</span>
          <span className={styles.stripLabel}>No Report</span>
        </div>
      )}
    </div>
  );
}

/* ─── Create Team Modal ──────────────────────────────────── */

interface CreateTeamModalProps {
  courseId: string;
  onCreated: (team: Team) => void;
  onClose: () => void;
}

function CreateTeamModal({ courseId, onCreated, onClose }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [googlePresentationUrl, setGooglePresentationUrl] = useState('');
  const [googleDocsUrl, setGoogleDocsUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'err'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStatus('saving');
    setErrorMsg('');

    const payload: CreateTeamPayload = {
      name: name.trim(),
      ...(githubRepo.trim() && { githubRepo: githubRepo.trim() }),
      ...(googleSheetsUrl.trim() && { googleSheetsUrl: googleSheetsUrl.trim() }),
      ...(googlePresentationUrl.trim() && { googlePresentationUrl: googlePresentationUrl.trim() }),
      ...(googleDocsUrl.trim() && { googleDocsUrl: googleDocsUrl.trim() }),
    };

    try {
      const team = await teamsApi.create(courseId, payload);
      onCreated(team);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Failed to create team.');
      setStatus('err');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-team-title">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="create-team-title">New Team</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          {/* Team name */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Team name <span className={styles.required}>*</span></label>
            <input
              className={styles.fieldInput}
              type="text"
              placeholder="e.g. Team Alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* GitHub */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub Repository
            </label>
            <input
              className={styles.fieldInput}
              type="url"
              placeholder="https://github.com/owner/repo"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
            />
          </div>

          <div className={styles.fieldDivider}>
            <span className={styles.fieldDividerLabel}>Google Workspace</span>
          </div>

          {/* Google Sheets */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.googleIcon} aria-hidden="true">📊</span>
              Google Sheets
            </label>
            <input
              className={styles.fieldInput}
              type="url"
              placeholder="https://docs.google.com/spreadsheets/..."
              value={googleSheetsUrl}
              onChange={(e) => setGoogleSheetsUrl(e.target.value)}
            />
          </div>

          {/* Google Slides */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.googleIcon} aria-hidden="true">📑</span>
              Google Slides (Presentation)
            </label>
            <input
              className={styles.fieldInput}
              type="url"
              placeholder="https://docs.google.com/presentation/..."
              value={googlePresentationUrl}
              onChange={(e) => setGooglePresentationUrl(e.target.value)}
            />
          </div>

          {/* Google Docs */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.googleIcon} aria-hidden="true">📄</span>
              Google Docs
            </label>
            <input
              className={styles.fieldInput}
              type="url"
              placeholder="https://docs.google.com/document/..."
              value={googleDocsUrl}
              onChange={(e) => setGoogleDocsUrl(e.target.value)}
            />
          </div>

          {errorMsg && <p className={styles.modalError}>{errorMsg}</p>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.modalSubmitBtn}
              disabled={status === 'saving' || !name.trim()}
            >
              {status === 'saving' ? 'Creating…' : 'Create team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { teacher, logout } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [reports, setReports] = useState<(TeamReport | null)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<TeamStatus | 'ALL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contributorsModal, setContributorsModal] = useState<{
    teamId: string;
    source: 'github' | 'drive';
    contributors: ContributorPreview[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);

    async function load() {
      try {
        const [c, fetchedTeams] = await Promise.all([
          coursesApi.getById(id!),
          teamsApi.getByCourse(id!),
        ]);

        // Fetch each team's report in parallel; a missing report is not an error
        const reportResults = await Promise.allSettled(
          fetchedTeams.map((t) => teamsApi.getReport(t._id)),
        );

        if (!cancelled) {
          setCourse(c);
          setTeams(fetchedTeams);
          setReports(
            reportResults.map((r) => (r.status === 'fulfilled' ? r.value : null)),
          );
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Failed to load course.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleTeamCreated(team: Team) {
    setTeams((prev) => [...prev, team]);
    setReports((prev) => [...prev, null]);
    setShowCreateModal(false);

    // Immediately preview contributors if a GitHub repo or Drive folder was linked
    const source = team.githubRepo ? 'github' : team.googleDriveFolder ? 'drive' : null;
    if (source) {
      try {
        const previews = await teamsApi.previewContributors(team._id, source);
        if (previews.length > 0) {
          setContributorsModal({ teamId: team._id, source, contributors: previews });
        }
      } catch { /* silent */ }
    }
  }

  async function handleImportConfirm(selected: ContributorPreview[]) {
    if (!contributorsModal) return;
    const updated = await teamsApi.importContributors(contributorsModal.teamId, selected);
    setTeams((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    setContributorsModal(null);
  }

  async function handleTeamDeleted(teamId: string) {
    if (!confirm('Delete this team? This cannot be undone.')) return;
    try {
      await teamsApi.delete(teamId);
      setTeams((prev) => {
        const idx = prev.findIndex((t) => t._id === teamId);
        if (idx === -1) return prev;
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      });
      setReports((prev) => {
        const idx = teams.findIndex((t) => t._id === teamId);
        if (idx === -1) return prev;
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      });
    } catch {
      // silently fail — team stays in list
    }
  }

  const filteredPairs = teams
    .map((team, i) => ({ team, report: reports[i] ?? null }))
    .filter(({ report }) =>
      filter === 'ALL' ? true : report?.status === filter,
    );

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
            ← My Courses
          </button>
          {course && <span className={styles.breadcrumbCurrent}>{course.title}</span>}
        </nav>

        {isLoading && (
          <div className={styles.stateWrap}>
            <div className={styles.spinner} />
            <p className={styles.stateText}>Loading teams…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className={styles.errorBox}>{error}</div>
        )}

        {!isLoading && !error && (
          <>
            <div className={styles.pageHeader}>
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>{course?.title ?? 'Course'}</h1>
                  {course?.description && (
                    <p className={styles.pageSubtitle}>{course.description}</p>
                  )}
                </div>
                <button
                  className={styles.newTeamBtn}
                  onClick={() => setShowCreateModal(true)}
                >
                  + New Team
                </button>
              </div>
            </div>

            {teams.length > 0 && <SummaryStrip reports={reports} />}

            {/* Filters */}
            {teams.length > 0 && (
              <div className={styles.filters}>
                {(['ALL', 'ON_TRACK', 'AT_RISK', 'BLOCKED'] as const).map((f) => (
                  <button
                    key={f}
                    className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'ALL' ? 'All teams' : STATUS_LABEL[f]}
                  </button>
                ))}
              </div>
            )}

            {teams.length === 0 && (
              <div className={styles.stateWrap}>
                <p className={styles.stateText}>No teams in this course yet.</p>
                <button className={styles.newTeamBtn} onClick={() => setShowCreateModal(true)}>
                  + New Team
                </button>
              </div>
            )}

            {teams.length > 0 && filteredPairs.length === 0 && (
              <div className={styles.stateWrap}>
                <p className={styles.stateText}>
                  No teams with status "{STATUS_LABEL[filter as TeamStatus]}".
                </p>
              </div>
            )}

            {filteredPairs.length > 0 && (
              <div className={styles.grid}>
                {filteredPairs.map(({ team, report }) => (
                  <TeamCard
                    key={team._id}
                    team={team}
                    report={report}
                    onClick={() => navigate(`/teams/${team._id}`)}
                    onDelete={() => handleTeamDeleted(team._id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showCreateModal && id && (
        <CreateTeamModal
          courseId={id}
          onCreated={handleTeamCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}

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
