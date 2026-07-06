import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coursesApi, type Course } from '../../api/courses';
import { teamsApi, type Team } from '../../api/teams';
import { ApiError } from '../../api/client';
import styles from './DashboardPage.module.css';

interface CourseWithTeams {
  course: Course;
  teams: Team[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CourseCard({ data }: { data: CourseWithTeams }) {
  const navigate = useNavigate();
  const { course, teams } = data;

  return (
    <button
      className={styles.card}
      onClick={() => navigate(`/courses/${course._id}`)}
      aria-label={`Open ${course.title}`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.courseInitial}>{course.title.charAt(0).toUpperCase()}</div>
        <div className={styles.cardTitle}>
          <h2 className={styles.courseName}>{course.title}</h2>
          {course.description && (
            <p className={styles.courseDesc}>{course.description}</p>
          )}
        </div>
        <span className={styles.teamCount}>
          {teams.length} team{teams.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={styles.dateRow}>
        <span className={styles.dateChip}>
          {formatDate(course.startDate)} → {formatDate(course.endDate)}
        </span>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.cardArrow}>View teams →</span>
        <span className={styles.createdAt}>Created {formatDate(course.createdAt)}</span>
      </div>
    </button>
  );
}

interface CreateModalProps {
  onClose: () => void;
  onCreated: (course: Course) => void;
}

function CreateCourseModal({ onClose, onCreated }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) {
      setFormError('Title, start date and end date are required.');
      return;
    }
    if (endDate <= startDate) {
      setFormError('End date must be after start date.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const course = await coursesApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
      });
      onCreated(course);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create course.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>New course</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="course-title">Title *</label>
            <input
              ref={titleRef}
              id="course-title"
              className={styles.input}
              type="text"
              placeholder="e.g. Software Engineering 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="course-desc">Description</label>
            <textarea
              id="course-desc"
              className={styles.textarea}
              placeholder="Optional short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={400}
            />
          </div>
          <div className={styles.dateRow2}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="course-start">Start date *</label>
              <input
                id="course-start"
                className={styles.input}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="course-end">End date *</label>
              <input
                id="course-end"
                className={styles.input}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {formError && <p className={styles.formError}>{formError}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type CourseFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type SortOption = 'DEFAULT' | 'LAST_UPDATED';

function isActive(course: Course): boolean {
  const now = Date.now();
  return new Date(course.startDate).getTime() <= now && now <= new Date(course.endDate).getTime();
}

export function DashboardPage() {
  const { teacher, logout } = useAuth();
  const [courseData, setCourseData] = useState<CourseWithTeams[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<CourseFilter>('ALL');
  const [sort, setSort] = useState<SortOption>('DEFAULT');
  const [periodYear, setPeriodYear] = useState<string>('ALL');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const courses = await coursesApi.getAll();

        // Fetch teams for each course in parallel
        const teamResults = await Promise.allSettled(
          courses.map((c) => teamsApi.getByCourse(c._id)),
        );

        if (!cancelled) {
          setCourseData(
            courses.map((course, i) => ({
              course,
              teams: teamResults[i].status === 'fulfilled' ? teamResults[i].value : [],
            })),
          );
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Failed to load courses.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const totalTeams = courseData.reduce((s, d) => s + d.teams.length, 0);

  const availableYears = Array.from(
    new Set(
      courseData.flatMap((d) => [
        new Date(d.course.startDate).getFullYear(),
        new Date(d.course.endDate).getFullYear(),
      ]),
    ),
  ).sort((a, b) => b - a);

  const filteredData = courseData
    .filter((d) => {
      if (filter === 'ACTIVE') return isActive(d.course);
      if (filter === 'INACTIVE') return !isActive(d.course);
      return true;
    })
    .filter((d) => {
      if (periodYear === 'ALL') return true;
      const year = Number(periodYear);
      const start = new Date(d.course.startDate).getFullYear();
      const end = new Date(d.course.endDate).getFullYear();
      return start === year || end === year;
    })
    .sort((a, b) => {
      if (sort === 'LAST_UPDATED') {
        return new Date(b.course.updatedAt).getTime() - new Date(a.course.updatedAt).getTime();
      }
      return 0;
    });

  function handleCourseCreated(course: Course) {
    setCourseData((prev) => [...prev, { course, teams: [] }]);
    setShowModal(false);
  }

  return (
    <div className={styles.page}>
      {showModal && (
        <CreateCourseModal
          onClose={() => setShowModal(false)}
          onCreated={handleCourseCreated}
        />
      )}
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
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            {!isLoading && !error && (
              <p className={styles.pageSubtitle}>
                {courseData.length} course{courseData.length !== 1 ? 's' : ''} · {totalTeams} teams total
              </p>
            )}
          </div>
          <button className={styles.newCourseBtn} onClick={() => setShowModal(true)}>
            + New course
          </button>
        </div>

        {isLoading && (
          <div className={styles.stateWrap}>
            <div className={styles.spinner} />
            <p className={styles.stateText}>Loading courses…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className={styles.errorBox}>{error}</div>
        )}

        {!isLoading && !error && courseData.length > 0 && (
          <div className={styles.filtersBar}>
            <div className={styles.filters}>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as CourseFilter[]).map((f) => (
                <button
                  key={f}
                  className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>
            <div className={styles.filterControls}>
              <select
                className={styles.filterSelect}
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                aria-label="Filter by period"
              >
                <option value="ALL">All periods</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort by"
              >
                <option value="DEFAULT">Default order</option>
                <option value="LAST_UPDATED">Last updated</option>
              </select>
            </div>
          </div>
        )}

        {!isLoading && !error && courseData.length === 0 && (
          <div className={styles.stateWrap}>
            <p className={styles.stateText}>No courses yet.</p>
          </div>
        )}

        {!isLoading && !error && courseData.length > 0 && filteredData.length === 0 && (
          <div className={styles.stateWrap}>
            <p className={styles.stateText}>No {filter.toLowerCase()} courses.</p>
          </div>
        )}

        {!isLoading && !error && filteredData.length > 0 && (
          <div className={styles.grid}>
            {filteredData.map((d) => (
              <CourseCard key={d.course._id} data={d} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
