import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { teamsApi, type Team, type TeamReport, type ActivityLog, type Student, type ContributorPreview, type AutoCheckMilestonesResult } from '../../api/teams';
import { ContributorsPreviewModal } from '../../components/ContributorsPreviewModal/ContributorsPreviewModal';
import { coursesApi, type Course } from '../../api/courses';
import { ApiError } from '../../api/client';
import { safeHref } from '../../lib/safeUrl';
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
		<svg
			viewBox={`0 0 ${W} ${H}`}
			className={styles.chart}
			aria-label='Activity over last 30 days'>
			{[0, 0.5, 1].map((frac) => {
				const y = PAD.top + innerH - frac * innerH;
				return (
					<g key={frac}>
						<line
							x1={PAD.left}
							x2={PAD.left + innerW}
							y1={y}
							y2={y}
							stroke='#e5e7eb'
							strokeWidth={1}
						/>
						<text
							x={PAD.left - 4}
							y={y + 4}
							textAnchor='end'
							fontSize={9}
							fill='#9ca3af'>
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
					<rect
						key={date}
						x={x}
						y={y}
						width={barW - gap}
						height={barH}
						rx={2}
						fill='#64748B'
						opacity={count === 0 ? 0.2 : 0.85}>
						<title>{`${date}: ${count} event${count !== 1 ? 's' : ''}`}</title>
					</rect>
				);
			})}
			{labelIndices.map((i) => {
				const [date] = entries[i] ?? [];
				if (!date) return null;
				const x = PAD.left + i * barW + barW / 2;
				const [yy, mm, dd] = date.split('-').map(Number);
				const label = new Date(yy, mm - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
				return (
					<text
						key={i}
						x={x}
						y={H - 4}
						textAnchor='middle'
						fontSize={9}
						fill='#9ca3af'>
						{label}
					</text>
				);
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

	const repoHref = safeHref(team.githubRepo);
	const driveHref = safeHref(team.googleDriveFolder);

	// useState only reads its initialiser once. The team is refetched after a
	// save or an import, so without these the inputs keep pre-save values and
	// githubChanged/driveChanged report phantom edits.
	useEffect(() => {
		setGithubInput(team.githubRepo ?? '');
	}, [team.githubRepo]);
	useEffect(() => {
		setDriveInput(team.googleDriveFolder ?? '');
	}, [team.googleDriveFolder]);

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
		try {
			const updated = await teamsApi.update(team._id, { googleDriveFolder: driveInput.trim() || undefined });
			onUpdated(updated);
			if (driveInput.trim()) {
				try {
					await teamsApi.syncDrive(team._id);
				} catch {
					/* silent */
				}
				await onSyncDrive();
			}
			setDriveStatus('ok');
			setTimeout(() => setDriveStatus('idle'), 3500);
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
					<svg
						className={styles.integrationIcon}
						viewBox='0 0 24 24'
						fill='currentColor'
						aria-hidden='true'>
						<path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' />
					</svg>
					<span className={styles.integrationName}>GitHub Repository</span>
					{team.githubRepo && <span className={styles.integrationConnected}>Connected</span>}
				</div>
				<p className={styles.integrationHint}>Repository contributors will be imported automatically as team members on save.</p>
				<div className={styles.integrationRow}>
					<input
						className={styles.integrationInput}
						type='url'
						placeholder='https://github.com/owner/repo'
						value={githubInput}
						onChange={(e) => setGithubInput(e.target.value)}
					/>
					<button
						className={`${styles.integrationBtn} ${githubStatus === 'ok' ? styles.integrationBtnOk : githubStatus === 'err' ? styles.integrationBtnErr : ''}`}
						onClick={saveGithub}
						disabled={githubStatus === 'saving' || isSyncing || !githubChanged}>
						{githubStatus === 'saving' || isSyncing ? 'Saving…' : githubStatus === 'ok' ? '✓ Saved & Synced' : githubStatus === 'err' ? 'Error' : 'Save & Sync'}
					</button>
				</div>
				{team.githubRepo && !githubChanged && (
					<div className={styles.integrationLinked}>
						{repoHref ? (
							<a
								href={repoHref}
								target='_blank'
								rel='noopener noreferrer'>
								{repoHref}
							</a>
						) : (
							<span>{team.githubRepo}</span>
						)}
						<button
							className={styles.reSyncBtn}
							onClick={onSyncGithub}
							disabled={isSyncing}>
							{isSyncing ? 'Syncing…' : '↻ Re-sync members'}
						</button>
					</div>
				)}
			</div>

			{/* Google Drive */}
			<div className={styles.integrationCard}>
				<div className={styles.integrationHeader}>
					<svg
						className={styles.integrationIcon}
						viewBox='0 0 24 24'
						fill='currentColor'
						aria-hidden='true'>
						<path d='M4.433 22.396l2.266-3.924H22.4l-2.267 3.924H4.433zM8.566 15.547L2.133 4.037 4.4.113l6.433 11.51-2.267 3.924zm5.668 0l-2.267-3.924L18.4.113l2.267 3.924-6.433 11.51z' />
					</svg>
					<span className={styles.integrationName}>Google Drive Folder</span>
					{team.googleDriveFolder && <span className={styles.integrationConnected}>Connected</span>}
				</div>
				<p className={styles.integrationHint}>Users with access to the Drive folder will be imported automatically as team members on save.</p>
				<div className={styles.integrationRow}>
					<input
						className={styles.integrationInput}
						type='url'
						placeholder='https://drive.google.com/drive/folders/...'
						value={driveInput}
						onChange={(e) => setDriveInput(e.target.value)}
					/>
					<button
						className={`${styles.integrationBtn} ${driveStatus === 'ok' ? styles.integrationBtnOk : driveStatus === 'err' ? styles.integrationBtnErr : ''}`}
						onClick={saveDrive}
						disabled={driveStatus === 'saving' || !driveChanged}>
						{driveStatus === 'saving' ? 'Saving…' : driveStatus === 'ok' ? '✓ Saved' : driveStatus === 'err' ? 'Error' : 'Save & Sync'}
					</button>
				</div>
				{team.googleDriveFolder && !driveChanged && (
					<div className={styles.integrationLinked}>
						{driveHref ? (
							<a
								href={driveHref}
								target='_blank'
								rel='noopener noreferrer'>
								{driveHref.replace('https://drive.google.com/drive/folders/', 'Drive folder: ')}
							</a>
						) : (
							<span>{team.googleDriveFolder}</span>
						)}
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
	milestones: Team['milestones'];
	onMembersChanged: () => void;
}

function MembersSection({ students, report, teamId, milestones, onMembersChanged }: MembersSectionProps) {
	const navigate = useNavigate();
	const [sortKey, setSortKey] = useState<SortKey>('contributionScore');
	const [showAddForm, setShowAddForm] = useState(false);
	const [addName, setAddName] = useState('');
	const [addEmail, setAddEmail] = useState('');
	const [addGithub, setAddGithub] = useState('');
	const [addStatus, setAddStatus] = useState<'idle' | 'saving'>('idle');
	const [addErr, setAddErr] = useState('');
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [isSendingReminder, setIsSendingReminder] = useState(false);
	const [reminderMsg, setReminderMsg] = useState('');
	const [reminderErr, setReminderErr] = useState('');

	// Merge students with report breakdown by email
	const enriched: EnrichedStudent[] = students.map((s) => {
		const bd = report?.studentBreakdown.find((b) => b.email === s.email.toLowerCase());
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

	const pendingMilestones = milestones.filter((m) => !m.completed);

	async function handleSendReminder() {
		if (pendingMilestones.length === 0 || students.length === 0) return;
		if (
			!confirm(
				`Send a deadline reminder email to all ${students.length} student${students.length === 1 ? '' : 's'} on this team, covering ${pendingMilestones.length} pending milestone${pendingMilestones.length === 1 ? '' : 's'}?`,
			)
		)
			return;

		setIsSendingReminder(true);
		setReminderMsg('');
		setReminderErr('');
		try {
			const { result } = await teamsApi.sendReminder(teamId);
			setReminderMsg(
				result.failed > 0
					? `Sent to ${result.studentsEmailed} student${result.studentsEmailed === 1 ? '' : 's'} — ${result.failed} failed.`
					: `Reminder sent to ${result.studentsEmailed} student${result.studentsEmailed === 1 ? '' : 's'}.`,
			);
		} catch (err) {
			setReminderErr(err instanceof ApiError ? err.message : 'Failed to send reminder.');
		} finally {
			setIsSendingReminder(false);
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
				<div className={styles.membersHeaderActions}>
					<button
						className={styles.addMemberToggle}
						onClick={handleSendReminder}
						disabled={isSendingReminder || pendingMilestones.length === 0 || students.length === 0}
						title={pendingMilestones.length === 0 ? 'No pending milestones to remind students about' : 'Email every student about the still-open milestones'}>
						{isSendingReminder ? 'Sending…' : '✉ Send reminder'}
					</button>
					<button
						className={styles.addMemberToggle}
						onClick={() => setShowAddForm((v) => !v)}>
						{showAddForm ? '✕ Cancel' : '+ Add member'}
					</button>
				</div>
			</div>
			{reminderErr && <p className={styles.addErr}>{reminderErr}</p>}
			{reminderMsg && <p className={styles.reminderMsg}>{reminderMsg}</p>}

			{/* Add member form */}
			{showAddForm && (
				<form
					className={styles.addForm}
					onSubmit={handleAdd}>
					<div className={styles.addFormRow}>
						<input
							className={styles.addInput}
							placeholder='Full name *'
							value={addName}
							onChange={(e) => setAddName(e.target.value)}
							required
						/>
						<input
							className={styles.addInput}
							type='email'
							placeholder='Email *'
							value={addEmail}
							onChange={(e) => setAddEmail(e.target.value)}
							required
						/>
						<input
							className={styles.addInput}
							placeholder='GitHub username (optional)'
							value={addGithub}
							onChange={(e) => setAddGithub(e.target.value)}
						/>
						<button
							type='submit'
							className={styles.addSubmitBtn}
							disabled={addStatus === 'saving'}>
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
							onClick={() => setSortKey(c.key)}>
							{c.label}
						</button>
					))}
				</div>
			)}

			{students.length === 0 && !showAddForm && <p className={styles.emptyText}>No members yet. Add one above or link a GitHub repo / Google Drive folder.</p>}

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
										<th
											className={styles.th}
											style={{ textAlign: 'right' }}>
											Commits
										</th>
										<th
											className={styles.th}
											style={{ textAlign: 'right' }}>
											PRs
										</th>
										<th className={styles.th}>Contribution</th>
									</>
								)}
								<th className={styles.th} />
							</tr>
						</thead>
						<tbody>
							{sorted.map((s, i) => (
								<tr
									key={s._id}
									className={`${styles.tr} ${hasStats && i === 0 ? styles.trTop : ''}`}>
									{hasStats && <td className={styles.tdRank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>}
									<td className={styles.td}>
										<div
											className={styles.memberCell}
											role='link'
											tabIndex={0}
											onClick={() => navigate(`/teams/${teamId}/students/${s._id}`)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') navigate(`/teams/${teamId}/students/${s._id}`);
											}}
											style={{ cursor: 'pointer' }}>
											<div className={styles.memberAvatar}>{s.name.charAt(0).toUpperCase()}</div>
											<div>
												<div className={styles.memberName}>{s.name}</div>
												<div className={styles.memberEmail}>{s.email}</div>
												{s.githubUsername && (
													<a
														href={`https://github.com/${s.githubUsername}`}
														target='_blank'
														rel='noopener noreferrer'
														className={styles.memberGithub}
														onClick={(e) => e.stopPropagation()}>
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
											title='Remove member'
											aria-label={`Remove ${s.name}`}>
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

interface MilestonesListProps {
	milestones: Team['milestones'];
	onToggle: (milestoneId: string, completed: boolean) => void;
	togglingId: string | null;
}

function MilestonesList({ milestones, onToggle, togglingId }: MilestonesListProps) {
	if (milestones.length === 0) {
		return <p className={styles.emptyText}>No milestones yet — add them from the course page and they'll show up here.</p>;
	}

	const sorted = [...milestones].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

	return (
		<ul className={styles.milestoneList}>
			{sorted.map((m) => {
				const overdue = !m.completed && new Date(m.dueDate) < new Date();
				return (
					<li
						key={m._id}
						className={`${styles.milestoneItem} ${m.completed ? styles.milestoneComplete : overdue ? styles.milestoneOverdue : ''}`}>
						<button
							type='button'
							className={styles.milestoneCheck}
							onClick={() => onToggle(m._id, !m.completed)}
							disabled={togglingId === m._id}
							aria-pressed={m.completed}
							title={m.completed ? 'Mark as not completed' : 'Mark as completed'}>
							{togglingId === m._id ? '…' : m.completed ? '✓' : overdue ? '!' : '○'}
						</button>
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
	const [askQuery, setAskQuery] = useState('');
	const [askAnswer, setAskAnswer] = useState('');
	const [isAsking, setIsAsking] = useState(false);
	const [askError, setAskError] = useState('');
	const [isRefreshingActivity, setIsRefreshingActivity] = useState(false);
	const [lastActivityRefresh, setLastActivityRefresh] = useState<Date | null>(null);
	const [activityRefreshError, setActivityRefreshError] = useState('');
	const [togglingMilestoneId, setTogglingMilestoneId] = useState<string | null>(null);
	const [isAutoChecking, setIsAutoChecking] = useState(false);
	const [autoCheckResult, setAutoCheckResult] = useState<AutoCheckMilestonesResult | null>(null);
	const [autoCheckError, setAutoCheckError] = useState('');

	async function handleAsk(query?: string) {
		const q = (query ?? askQuery).trim();
		if (!q || !id) return;
		if (query) setAskQuery(query);
		setIsAsking(true);
		setAskAnswer('');
		setAskError('');
		try {
			const { answer } = await teamsApi.ask(id, q);
			setAskAnswer(answer);
		} catch {
			setAskError('Failed to get an answer. Try again.');
		} finally {
			setIsAsking(false);
		}
	}

	const load = useCallback(async () => {
		if (!id) return;
		setIsLoading(true);
		setError('');
		try {
			const t = await teamsApi.getById(id);
			setTeam(t);

			const [reportResult, activityResult, courseResult] = await Promise.allSettled([teamsApi.getReport(id), teamsApi.getActivity(id), coursesApi.getById(t.courseId)]);

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

	useEffect(() => {
		load();
	}, [load]);

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

	// Checks GitHub (commits/PRs) and the linked Google Drive Docs/Sheets/Slides
	// for anything new since the last check, logs it as activity, then reloads
	// the activity feed and stats. Does not force-regenerate the AI report —
	// the report's own cache already invalidates itself when activity counts change.
	async function handleRefreshActivity() {
		if (!id || !team) return;
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
			if (hasGithub) syncTasks.push(teamsApi.syncGithub(id));
			if (hasDrive) syncTasks.push(teamsApi.syncDriveActivity(id));
			const syncResults = await Promise.allSettled(syncTasks);
			const anySyncFailed = syncResults.some((r) => r.status === 'rejected');

			const [activityResult, reportResult] = await Promise.allSettled([teamsApi.getActivity(id), teamsApi.getReport(id)]);
			if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
			if (reportResult.status === 'fulfilled') setReport(reportResult.value);
			await reloadTeam();

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

	// Toggles this team's own copy of a milestone. Title/description/dueDate are
	// managed course-wide (see the course page) — this only flips `completed`.
	async function handleToggleMilestone(milestoneId: string, completed: boolean) {
		if (!id) return;
		setTogglingMilestoneId(milestoneId);
		try {
			await teamsApi.setMilestoneCompleted(id, milestoneId, completed);
			await reloadTeam();
		} catch {
			// silent — matches the rest of the page's background-mutation pattern
		} finally {
			setTogglingMilestoneId(null);
		}
	}

	// Syncs the latest GitHub/Drive activity, then asks the AI to check off any
	// pending milestone the fresh evidence clearly supports. Only ever adds
	// completions — a milestone the professor already checked by hand is never
	// touched, and the AI is told to leave ambiguous cases pending.
	async function handleAutoCheckMilestones() {
		if (!id || !team) return;
		setIsAutoChecking(true);
		setAutoCheckError('');
		setAutoCheckResult(null);
		try {
			const hasGithub = Boolean(team.githubRepo);
			const hasDrive = Boolean(team.googleDriveFolder);
			const syncTasks: Promise<unknown>[] = [];
			if (hasGithub) syncTasks.push(teamsApi.syncGithub(id));
			if (hasDrive) syncTasks.push(teamsApi.syncDriveActivity(id));
			if (syncTasks.length > 0) await Promise.allSettled(syncTasks);

			const { result } = await teamsApi.autoCheckMilestones(id);
			setAutoCheckResult(result);

			const [activityResult, reportResult] = await Promise.allSettled([teamsApi.getActivity(id), teamsApi.getReport(id)]);
			if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
			if (reportResult.status === 'fulfilled') setReport(reportResult.value);
			await reloadTeam();
		} catch {
			setAutoCheckError('Failed to auto-check milestones.');
		} finally {
			setIsAutoChecking(false);
		}
	}

	const headerRepoHref = safeHref(team?.githubRepo);
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
							<div
								className={styles.headerLeft}
								style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
								<div className={styles.teamInitial}>{team.name.charAt(0).toUpperCase()}</div>
								<div>
									<div className={styles.teamNameRow}>
										<h1 className={styles.teamName}>{team.name}</h1>
										{report && <StatusBadge status={report.status} />}
									</div>
									{headerRepoHref ? (
										<a
											href={headerRepoHref}
											target='_blank'
											rel='noopener noreferrer'
											className={styles.repoLink}>
											<svg
												width='13'
												height='13'
												viewBox='0 0 24 24'
												fill='currentColor'
												aria-hidden='true'>
												<path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' />
											</svg>
											{headerRepoHref.replace('https://github.com/', '')}
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
								title='Delete team'>
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
								<span className={styles.statValue}>{totalMilestones > 0 ? `${completedMilestones}/${totalMilestones}` : '—'}</span>
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
									milestones={team.milestones}
									onMembersChanged={reloadTeam}
								/>

								{/* Activity Chart */}
								<section className={styles.section}>
									<div className={styles.sectionHeaderRow}>
										<h2 className={styles.sectionTitle}>Activity (last 30 days)</h2>
										<div className={styles.refreshActivityWrap}>
											{lastActivityRefresh && !isRefreshingActivity && <span className={styles.lastRefreshedText}>Updated {fmtTime(lastActivityRefresh)}</span>}
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
									{activity.length > 0 ? <ActivityChart logs={activity} /> : <p className={styles.emptyText}>No activity logged yet.</p>}
								</section>

								{/* Ask AI */}
								<section className={styles.section}>
									<h2 className={styles.sectionTitle}>Ask about this team</h2>
									<p className={styles.askSubtitle}>Ask anything about this team's activity, students or milestones.</p>
									<form
										className={styles.askRow}
										onSubmit={(e) => {
											e.preventDefault();
											handleAsk();
										}}>
										<input
											className={styles.askInput}
											type='text'
											placeholder='Who contributed the most this week?'
											value={askQuery}
											onChange={(e) => setAskQuery(e.target.value)}
											disabled={isAsking}
										/>
										<button
											className={styles.askBtn}
											type='submit'
											disabled={isAsking || !askQuery.trim()}>
											{isAsking ? '…' : 'Ask'}
										</button>
									</form>
									<div className={styles.askChips}>
										{['When was the last commit?', 'Is anyone not contributing?', 'Which milestones are overdue?', 'What should the team focus on?'].map((q) => (
											<button
												key={q}
												className={styles.askChip}
												onClick={() => handleAsk(q)}
												disabled={isAsking}>
												{q}
											</button>
										))}
									</div>
									{askError && <p className={styles.askError}>{askError}</p>}
									{askAnswer && (
										<div className={styles.askAnswer}>
											<div className={styles.askAnswerLabel}>AI answer</div>
											<p className={styles.askAnswerText}>{askAnswer}</p>
										</div>
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
											<span className={styles.reportAge}>{new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
										</h2>
										{report.summary && <p className={styles.summary}>{report.summary}</p>}
										{report.concerns.length > 0 && (
											<div className={styles.concerns}>
												<div className={styles.concernsTitle}>⚠ Concerns</div>
												<ul className={styles.bulletList}>
													{report.concerns.map((c, i) => (
														<li key={i}>{c}</li>
													))}
												</ul>
											</div>
										)}
										{report.recommendations.length > 0 && (
											<div className={styles.recommendations}>
												<div className={styles.recsTitle}>💡 Recommendations</div>
												<ul className={styles.bulletList}>
													{report.recommendations.map((r, i) => (
														<li key={i}>{r}</li>
													))}
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
											<span className={styles.sectionBadge}>
												{completedMilestones}/{totalMilestones}
											</span>
										)}
										{totalMilestones > 0 && (
											<button
												className={styles.autoCheckBtn}
												onClick={handleAutoCheckMilestones}
												disabled={
													isAutoChecking ||
													completedMilestones === totalMilestones ||
													(!team.githubRepo && !team.googleDriveFolder)
												}
												title="Sync activity and let the AI check off milestones the evidence supports">
												<RefreshIcon spinning={isAutoChecking} />
												{isAutoChecking ? 'Checking…' : 'Auto-check'}
											</button>
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
									{autoCheckError && <p className={styles.refreshError}>{autoCheckError}</p>}
									{autoCheckResult && (
										<p className={styles.autoCheckSummary}>
											{autoCheckResult.newlyCompleted.length > 0
												? `✓ Marked done: ${autoCheckResult.newlyCompleted.map((m) => m.title).join(', ')}`
												: autoCheckResult.checked === 0
													? 'Nothing to check — no pending milestones.'
													: 'No pending milestone had clear evidence of completion yet.'}
										</p>
									)}
									<MilestonesList
										milestones={team.milestones}
										onToggle={handleToggleMilestone}
										togglingId={togglingMilestoneId}
									/>
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
