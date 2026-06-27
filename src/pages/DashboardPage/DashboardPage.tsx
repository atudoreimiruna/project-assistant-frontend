import { useEffect, useState } from 'react';
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

export function DashboardPage() {
  const { teacher, logout } = useAuth();
  const [courseData, setCourseData] = useState<CourseWithTeams[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>My Courses</h1>
          {!isLoading && !error && (
            <p className={styles.pageSubtitle}>
              {courseData.length} course{courseData.length !== 1 ? 's' : ''} · {totalTeams} teams total
            </p>
          )}
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

        {!isLoading && !error && courseData.length === 0 && (
          <div className={styles.stateWrap}>
            <p className={styles.stateText}>No courses yet.</p>
          </div>
        )}

        {!isLoading && !error && courseData.length > 0 && (
          <div className={styles.grid}>
            {courseData.map((d) => (
              <CourseCard key={d.course._id} data={d} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
