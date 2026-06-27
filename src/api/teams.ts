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
  students: Student[];
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export const teamsApi = {
  getByCourse: (courseId: string) => api.get<Team[]>(`/courses/${courseId}/teams`),
  getById: (id: string) => api.get<Team>(`/teams/${id}`),
  getReport: (teamId: string) => api.get<TeamReport>(`/teams/${teamId}/report`),
};
