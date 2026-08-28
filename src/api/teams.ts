import { api } from './client';

export type TeamStatus = 'ON_TRACK' | 'AT_RISK' | 'BLOCKED';

export interface Student {
  _id: string;
  name: string;
  email: string;
  githubUsername?: string;
}

export interface Milestone {
  _id: string;
  title: string;
  description?: string;
  dueDate: string;
  completed: boolean;
}

export interface StudentBreakdown {
  name: string;
  email: string;
  commits: number;
  prs: number;
  contributionScore: number;
}

export interface TeamReport {
  _id: string;
  teamId: string;
  status: TeamStatus;
  summary: string;
  concerns: string[];
  recommendations: string[];
  studentBreakdown: StudentBreakdown[];
  activityCount: number;
  generatedAt: string;
}

export interface Team {
  _id: string;
  courseId: string;
  name: string;
  githubRepo?: string;
  googleDriveFolder?: string;
  students: Student[];
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamPayload {
  name: string;
  githubRepo?: string;
  googleSheetsUrl?: string;
  googlePresentationUrl?: string;
  googleDocsUrl?: string;
}

export interface AddStudentPayload {
  name: string;
  email: string;
  githubUsername?: string;
}

export interface ContributorPreview {
  name: string;
  email: string;
  githubUsername?: string;
  alreadyMember: boolean;
  possibleDuplicate?: string;
  /** False when `email` is a non-deliverable GitHub noreply placeholder. */
  hasRealEmail: boolean;
}

export interface ActivityLog {
  _id: string;
  teamId: string;
  type: 'commit' | 'pr' | 'issue' | 'document';
  studentEmail?: string;
  description: string;
  timestamp: string;
  metadata?: {
    url?: string;
    driveFileId?: string;
    mimeType?: string;
    [key: string]: unknown;
  };
}

export interface MilestoneCheckResult {
  milestoneId: string;
  title: string;
  reason: string;
}

export interface AutoCheckMilestonesResult {
  checked: number;
  newlyCompleted: MilestoneCheckResult[];
  stillPending: MilestoneCheckResult[];
}

export const teamsApi = {
  getByCourse: (courseId: string) => api.get<Team[]>(`/courses/${courseId}/teams`),
  create: (courseId: string, payload: CreateTeamPayload) =>
    api.post<Team>(`/courses/${courseId}/teams`, payload),
  getById: (id: string) => api.get<Team>(`/teams/${id}`),
  update: (id: string, body: Partial<Pick<Team, 'name' | 'githubRepo' | 'googleDriveFolder'>>) =>
    api.put<Team>(`/teams/${id}`, body),
  getReport: (teamId: string) => api.get<TeamReport>(`/teams/${teamId}/report`),
  getActivity: (teamId: string) => api.get<ActivityLog[]>(`/teams/${teamId}/activity`),
  syncGithub: (teamId: string) => api.post<{ ok: boolean }>(`/teams/${teamId}/sync-github`, {}),
  syncDrive: (teamId: string) => api.post<{ ok: boolean }>(`/teams/${teamId}/sync-drive`, {}),
  syncDriveActivity: (teamId: string) =>
    api.post<{ ok: boolean; result: { filesChecked: number; newActivity: number } }>(`/teams/${teamId}/sync-drive-activity`, {}),
  delete: (id: string) => api.delete<void>(`/teams/${id}`),
  previewContributors: (teamId: string, source: 'github' | 'drive') =>
    api.get<ContributorPreview[]>(`/teams/${teamId}/preview-contributors`, { params: { source } }),
  importContributors: (teamId: string, contributors: ContributorPreview[]) =>
    api.post<Team>(`/teams/${teamId}/import-contributors`, { contributors }),
  addStudent: (teamId: string, payload: AddStudentPayload) =>
    api.post<Student>(`/teams/${teamId}/students`, payload),
  removeStudent: (teamId: string, studentId: string) =>
    api.delete<void>(`/teams/${teamId}/students/${studentId}`),
  setMilestoneCompleted: (teamId: string, milestoneId: string, completed: boolean) =>
    api.put<Milestone>(`/teams/${teamId}/milestones/${milestoneId}`, { completed }),
  getStudentActivity: (teamId: string, studentId: string) =>
    api.get<ActivityLog[]>(`/teams/${teamId}/students/${studentId}/activity`),
  sendReminder: (teamId: string) =>
    api.post<{ ok: boolean; result: { studentsEmailed: number; failed: number; milestonesIncluded: number } }>(
      `/teams/${teamId}/send-reminder`,
      {},
    ),
  autoCheckMilestones: (teamId: string) =>
    api.post<{ ok: boolean; result: AutoCheckMilestonesResult }>(`/teams/${teamId}/auto-check-milestones`, {}),
  ask: (teamId: string, query: string) =>
    api.post<{ answer: string }>(`/teams/${teamId}/ask`, { query }),
};
