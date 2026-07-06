import { api } from './client';

export interface Course {
  _id: string;
  title: string;
  description?: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoursePayload {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export const coursesApi = {
  getAll: () => api.get<Course[]>('/courses'),
  getById: (id: string) => api.get<Course>(`/courses/${id}`),
  create: (payload: CreateCoursePayload) => api.post<Course>('/courses', payload),
};
