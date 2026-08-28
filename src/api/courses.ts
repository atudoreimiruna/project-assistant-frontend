import { api, downloadFile } from './client';

export interface CourseMilestone {
  _id: string;
  title: string;
  description?: string;
  dueDate: string;
}

export interface Course {
  _id: string;
  title: string;
  description?: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  milestones: CourseMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoursePayload {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export interface CourseMilestonePayload {
  title: string;
  description?: string;
  dueDate: string;
}

export const coursesApi = {
  getAll: () => api.get<Course[]>('/courses'),
  getById: (id: string) => api.get<Course>(`/courses/${id}`),
  create: (payload: CreateCoursePayload) => api.post<Course>('/courses', payload),
  exportTeams: (id: string, fallbackFilename: string) => downloadFile(`/courses/${id}/export`, fallbackFilename),
  createMilestone: (courseId: string, payload: CourseMilestonePayload) =>
    api.post<CourseMilestone>(`/courses/${courseId}/milestones`, payload),
  updateMilestone: (courseId: string, milestoneId: string, payload: Partial<CourseMilestonePayload>) =>
    api.put<CourseMilestone>(`/courses/${courseId}/milestones/${milestoneId}`, payload),
  deleteMilestone: (courseId: string, milestoneId: string) =>
    api.delete<void>(`/courses/${courseId}/milestones/${milestoneId}`),
};
