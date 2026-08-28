import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { teamsApi, type Team, type TeamReport, type ActivityLog, type Student, type TeamStatus } from '../../api/teams';
import { coursesApi, type Course } from '../../api/courses';
import { ApiError } from '../../api/client';
import styles from './StudentPage.module.css';

/* ─── Helpers ──────────────────────────────────────────── */

function daysAgo(n: number) {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
}

function dayKey(d: Date) {
	return d.toISOString().slice(0, 10);
}

function timeAgo(iso: string) {
	const ms = Date.now() - new Date(iso).getTime();
	const min = Math.floor(ms / 60000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min ago`;
	const hrs = Math.floor(min / 60);
	if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
	const days = Math.floor(hrs / 24);
	if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
	const months = Math.floor(days / 30);
	return `${months} month${months === 1 ? '' : 's'} ago`;
}

const STATUS_LABEL: Record<TeamStatus, string> = {
	ON_TRACK: 'On Track',
	AT_RISK: 'At Risk',
	BLOCKED: 'Blocked',
};

const STATUS_MOD: Record<TeamStatus, string> = {
	ON_TRACK: 'statusOnTrack',
	AT_RISK: 'statusAtRisk',
	BLOCKED: 'statusBlocked',
};

function StatusBadge({ status }: { status: TeamStatus }) {
	return (
		<span className={`${styles.statusBadge} ${styles[STATUS_MOD[status]]}`}>
			<span className={styles.statusDot} />
			{STATUS_LABEL[status]}
		</span>
	);
}

/* ─── Commit frequency heatmap ────────────────────────────
   GitHub-style contribution grid built from this student's own commit
   activity over the last 30 days — no invented metrics, just a count per day. */

const HEATMAP_DAYS = 30;

function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
	if (count <= 0) return 0;
	if (count === 1) return 1;
	if (count === 2) return 2;
	if (count === 3) return 3;
	return 4;
}

function CommitHeatmap({ commits }: { commits: ActivityLog[] }) {
	const buckets: Record<string, number> = {};
	for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
		buckets[dayKey(daysAgo(i))] = 0;
	}
	for (const c of commits) {
		const key = new Date(c.timestamp).toISOString().slice(0, 10);
		if (key in buckets) buckets[key]++;
	}

	const entries = Object.entries(buckets); // oldest -> newest

	return (
		<div>
			<div className={styles.heatmapGrid}>
				{entries.map(([date, count]) => (
					<div
						key={date}
						className={`${styles.heatmapCell} ${styles[`heatmapLevel${heatmapLevel(count)}`]}`}
						title={`${count} commit${count === 1 ? '' : 's'} on ${date}`}
					/>
				))}
			</div>
			<div className={styles.heatmapLegend}>
				<span>Less</span>
				{[0, 1, 2, 3, 4].map((lvl) => (
					<div
						key={lvl}
						className={`${styles.heatmapCell} ${styles[`heatmapLevel${lvl}`]}`}
					/>
				))}
				<span>More</span>
			</div>
		</div>
	);
}

/* ─── Linked documents ─────────────────────────────────────
   Derived from this student's own 'document' activity logs, deduped to the
   latest entry per Drive file. No completion % — we don't track that. */

interface LinkedDoc {
	fileId: string;
	label: string;
	name: string;
	url?: string;
	updatedAt: string;
}

function parseDocDescription(description: string): { label: string; name: string } {
	const match = description.match(/^(\S+)\s+"(.+)"\s+updated/);
	if (match) return { label: match[1], name: match[2] };
	return { label: 'File', name: description };
}

const DOC_ICON_CLASS: Record<string, string> = {
	Doc: 'docIconDoc',
	Sheet: 'docIconSheet',
	Slides: 'docIconSlides',
	Form: 'docIconForm',
};

function buildLinkedDocs(documentLogs: ActivityLog[]): LinkedDoc[] {
	const byFile = new Map<string, LinkedDoc>();
	for (const log of documentLogs) {
		const fileId = log.metadata?.driveFileId || log._id;
		const { label, name } = parseDocDescription(log.description);
		const existing = byFile.get(fileId);
		if (!existing || new Date(log.timestamp) > new Date(existing.updatedAt)) {
			byFile.set(fileId, { fileId, label, name, url: log.metadata?.url, updatedAt: log.timestamp });
		}
	}
	return Array.from(byFile.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/* ─── Refresh activity ─────────────────────────────────── */

function RefreshIcon({ spinning }: { spinning: boolean }) {
	return (
		<svg
			className={`${styles.refreshIcon} ${spinning ? styles.refreshIconSpin : ''}`}
			width='13'
			height='13'
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='2.2'
			strokeLinecap='round'
			strokeLinejoin='round'
			aria-hidden='true'>
			<path d='M21 12a9 9 0 1 1-2.64-6.36' />
			<polyline points='21 3 21 9 15 9' />
		</svg>
	);
}

function fmtTime(d: Date) {
	return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/* ─── Main Page ────────────────────────────────────────── */

export function StudentPage() {
	const { teamId, studentId } = useParams<{ teamId: string; studentId: string }>();
	const navigate = useNavigate();
	const { teacher, logout } = useAuth();

	const [team, setTeam] = useState<Team | null>(null);
	const [course, setCourse] = useState<Course | null>(null);
	const [report, setReport] = useState<TeamReport | null>(null);
	const [activity, setActivity] = useState<ActivityLog[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [isRemoving, setIsRemoving] = useState(false);
	const [isRefreshingActivity, setIsRefreshingActivity] = useState(false);
	const [lastActivityRefresh, setLastActivityRefresh] = useState<Date | null>(null);
	const [activityRefreshError, setActivityRefreshError] = useState('');

	const load = useCallback(async () => {
		if (!teamId || !studentId) return;
		setIsLoading(true);
		setError('');
		try {
			const t = await teamsApi.getById(teamId);
			setTeam(t);

			const [courseResult, reportResult, activityResult] = await Promise.allSettled([
				coursesApi.getById(t.courseId),
				teamsApi.getReport(teamId),
				teamsApi.getStudentActivity(teamId, studentId),
			]);
			if (courseResult.status === 'fulfilled') setCourse(courseResult.value);
			if (reportResult.status === 'fulfilled') setReport(reportResult.value);
			if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Failed to load student.');
		} finally {
			setIsLoading(false);
		}
	}, [teamId, studentId]);

	useEffect(() => {
		load();
	}, [load]);

	const student: Student | undefined = team?.students.find((s) => s._id === studentId);

	const commits = useMemo(() => activity.filter((a) => a.type === 'commit'), [activity]);
	const prs = useMemo(() => activity.filter((a) => a.type === 'pr'), [activity]);
	const documents = useMemo(() => buildLinkedDocs(activity.filter((a) => a.type === 'document')), [activity]);
	const lastActivity = activity[0];

	async function handleRemove() {
		if (!team || !student || !teamId) return;
		if (!confirm(`Remove ${student.name} from "${team.name}"? This cannot be undone.`)) return;
		setIsRemoving(true);
		try {
			await teamsApi.removeStudent(teamId, student._id);
			navigate(`/teams/${teamId}`);
		} catch {
			setError('Failed to remove student.');
			setIsRemoving(false);
		}
	}

	// Checks GitHub and the linked Google Drive folder for anything new since
	// the last check (team-wide — GitHub/Drive don't expose a per-student sync),
	// then reloads just this student's activity feed and stats.
	async function handleRefreshActivity() {
		if (!teamId || !studentId || !team) return;
		const hasGithub = Boolean(team.githubRepo);
		const hasDrive = Boolean(team.googleDriveFolder);
		if (!hasGithub && !hasDrive) {
			setActivityRefreshError('Link a GitHub repo or Google Drive folder first.');
			return;
		}

		setIsRefreshingActivity(true);
		setActivityRefreshError('');
		try {
			const syncTasks: Promise<unknown>[] = [];
			if (hasGithub) syncTasks.push(teamsApi.syncGithub(teamId));
			if (hasDrive) syncTasks.push(teamsApi.syncDriveActivity(teamId));
			const syncResults = await Promise.allSettled(syncTasks);
			const anySyncFailed = syncResults.some((r) => r.status === 'rejected');

			const [activityResult, reportResult] = await Promise.allSettled([
				teamsApi.getStudentActivity(teamId, studentId),
				teamsApi.getReport(teamId),
			]);
			if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
			if (reportResult.status === 'fulfilled') setReport(reportResult.value);

			if (anySyncFailed) {
				setActivityRefreshError('Some sources failed to refresh — showing the latest data available.');
			} else {
				setLastActivityRefresh(new Date());
			}
		} catch {
			setActivityRefreshError('Failed to refresh activity.');
		} finally {
			setIsRefreshingActivity(false);
		}
	}

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
					<button
						className={styles.logoutBtn}
						onClick={logout}>
						Sign out
					</button>
				</div>
			</header>

			<main className={styles.main}>
				{/* Breadcrumb */}
				<nav className={styles.breadcrumb}>
					<button
						className={styles.breadcrumbBack}
						onClick={() => navigate('/dashboard')}>
						My Courses
					</button>
					<span className={styles.breadcrumbSep}>›</span>
					{course && (
						<>
							<button
								className={styles.breadcrumbBack}
								onClick={() => navigate(`/courses/${course._id}`)}>
								{course.title}
							</button>
							<span className={styles.breadcrumbSep}>›</span>
						</>
					)}
					{team && (
						<>
							<button
								className={styles.breadcrumbBack}
								onClick={() => navigate(`/teams/${team._id}`)}>
								{team.name}
							</button>
							<span className={styles.breadcrumbSep}>›</span>
						</>
					)}
					{student && <span className={styles.breadcrumbCurrent}>{student.name}</span>}
				</nav>

				{isLoading && (
					<div className={styles.stateWrap}>
						<div className={styles.spinner} />
						<p className={styles.stateText}>Loading student…</p>
					</div>
				)}

				{!isLoading && error && <div className={styles.errorBox}>{error}</div>}

				{!isLoading && !error && team && !student && (
					<div className={styles.errorBox}>
						Student not found. They may have been removed from the team.{' '}
						<Link
							to={`/teams/${team._id}`}
							className={styles.inlineLink}>
							Back to {team.name}
						</Link>
					</div>
				)}

				{!isLoading && !error && team && student && (
					<>
						{/* ── Profile header ── */}
						<div className={styles.profileCard}>
							<div className={styles.profileTop}>
								<div className={styles.avatarCircle}>{student.name.charAt(0).toUpperCase()}</div>
								<div className={styles.profileInfo}>
									<div className={styles.nameRow}>
										<h1 className={styles.studentName}>{student.name}</h1>
										{report && <StatusBadge status={report.status} />}
									</div>
									<p className={styles.subtitle}>
										{course ? `${course.title} · ${team.name}` : team.name}
									</p>
									<div className={styles.contactRow}>
										{student.githubUsername && (
											<a
												href={`https://github.com/${student.githubUsername}`}
												target='_blank'
												rel='noopener noreferrer'
												className={styles.contactItem}>
												<svg
													width='13'
													height='13'
													viewBox='0 0 24 24'
													fill='currentColor'
													aria-hidden='true'>
													<path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' />
												</svg>
												{student.githubUsername}
											</a>
										)}
										<a
											href={`mailto:${student.email}`}
											className={styles.contactItem}>
											<svg
												width='13'
												height='13'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'
												aria-hidden='true'>
												<path d='M4 4h16v16H4z' />
												<path d='m22 6-10 7L2 6' />
											</svg>
											{student.email}
										</a>
									</div>
								</div>
								<div className={styles.profileActions}>
									<a
										href={`mailto:${student.email}`}
										className={styles.emailBtn}>
										✉ Email
									</a>
									<button
										className={styles.removeStudentBtn}
										onClick={handleRemove}
										disabled={isRemoving}>
										{isRemoving ? 'Removing…' : 'Remove from team'}
									</button>
								</div>
							</div>
						</div>

						{/* ── Two-col layout ── */}
						<div className={styles.grid}>
							{/* Left: Repository Activity */}
							<div className={styles.col}>
								<section className={styles.section}>
									<div className={styles.sectionHeaderRow}>
										<h2 className={styles.sectionTitle}>Repository Activity</h2>
										<div className={styles.refreshActivityWrap}>
											{team.githubRepo && <span className={styles.sectionBadge}>main branch</span>}
											{lastActivityRefresh && !isRefreshingActivity && (
												<span className={styles.lastRefreshedText}>Updated {fmtTime(lastActivityRefresh)}</span>
											)}
											<button
												className={styles.refreshActivityBtn}
												onClick={handleRefreshActivity}
												disabled={isRefreshingActivity || (!team.githubRepo && !team.googleDriveFolder)}
												title='Check GitHub and Google Drive for new activity'>
												<RefreshIcon spinning={isRefreshingActivity} />
												{isRefreshingActivity ? 'Refreshing…' : 'Refresh activity'}
											</button>
										</div>
									</div>
									{activityRefreshError && <p className={styles.refreshError}>{activityRefreshError}</p>}

									<div className={styles.repoStatsRow}>
										<div className={styles.repoStatTile}>
											<span className={styles.repoStatLabel}>Total Commits</span>
											<span className={styles.repoStatValue}>{commits.length}</span>
										</div>
										<div className={styles.repoStatTile}>
											<span className={styles.repoStatLabel}>Pull Requests</span>
											<span className={styles.repoStatValue}>{prs.length}</span>
										</div>
										<div className={`${styles.repoStatTile} ${styles.repoStatTileAccent}`}>
											<span className={styles.repoStatLabel}>Last Activity</span>
											<span className={styles.repoStatValue}>{lastActivity ? timeAgo(lastActivity.timestamp) : '—'}</span>
										</div>
									</div>

									<h3 className={styles.heatmapTitle}>Commit Frequency (Last 30 Days)</h3>
									{commits.length > 0 ? (
										<CommitHeatmap commits={commits} />
									) : (
										<p className={styles.emptyText}>No commits recorded for this student yet.</p>
									)}
								</section>
							</div>

							{/* Right: Linked Documents */}
							<div className={styles.col}>
								<section className={styles.section}>
									<h2 className={styles.sectionTitle}>Linked Documents</h2>
									{documents.length === 0 ? (
										<p className={styles.emptyText}>No documents linked yet.</p>
									) : (
										<ul className={styles.docList}>
											{documents.map((doc) => (
												<li
													key={doc.fileId}
													className={styles.docItem}>
													<div className={`${styles.docIcon} ${styles[DOC_ICON_CLASS[doc.label] ?? 'docIconFile']}`}>
														{doc.label.charAt(0)}
													</div>
													<div className={styles.docBody}>
														<div className={styles.docName}>{doc.name}</div>
														<div className={styles.docMeta}>Updated {timeAgo(doc.updatedAt)}</div>
													</div>
													{doc.url && (
														<a
															href={doc.url}
															target='_blank'
															rel='noopener noreferrer'
															className={styles.docOpenLink}>
															Open ↗
														</a>
													)}
												</li>
											))}
										</ul>
									)}
								</section>
							</div>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
