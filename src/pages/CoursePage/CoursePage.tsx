import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coursesApi, type Course } from '../../api/courses';
import { teamsApi, type Team, type TeamReport, type TeamStatus } from '../../api/teams';
import { ApiError } from '../../api/client';
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

function TeamCard({ team, report }: { team: Team; report: TeamReport | null }) {
  const status = report?.status;
  const lastGenerated = report?.generatedAt
    ? new Date(report.generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className={`${styles.card} ${status ? CARD_MOD[status] : ''}`}>
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
              <h1 className={styles.pageTitle}>{course?.title ?? 'Course'}</h1>
              {course?.description && (
                <p className={styles.pageSubtitle}>{course.description}</p>
              )}
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
                  <TeamCard key={team._id} team={team} report={report} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
