import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
		this.name = 'ApiError';
	}
}

let onUnauthorized: (() => void) | null = null;
let notifyError: ((message: string) => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
	onUnauthorized = fn;
}

export function setErrorNotifier(fn: ((message: string) => void) | null) {
	notifyError = fn;
}

const http = axios.create({
	baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
	timeout: 15_000,
	headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
	const token = localStorage.getItem('token');
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

function messageFor(error: AxiosError<{ message?: string }>): string {
	const data = error.response?.data;
	if (data && typeof data === 'object' && typeof data.message === 'string') {
		return data.message;
	}
	if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
	if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
	return error.response?.statusText || 'Request failed';
}

http.interceptors.response.use(
	(res) => res,
	(error: AxiosError<{ message?: string }>) => {
		const status = error.response?.status ?? 0;
		const message = messageFor(error);

		if (status === 401) {
			// Expired or revoked token: drop the session so ProtectedRoute bounces
			// to /login instead of leaving the user on a page that 401s forever.
			onUnauthorized?.();
		} else {
			// Surfaced centrally so a failure is never fully silent, even where the
			// caller swallows it.
			notifyError?.(message);
		}

		return Promise.reject(new ApiError(status, message));
	},
);

export const api = {
	get: <T>(path: string, config?: AxiosRequestConfig) => http.get<T>(path, config).then((r) => r.data),
	post: <T>(path: string, body?: unknown) => http.post<T>(path, body).then((r) => r.data),
	put: <T>(path: string, body?: unknown) => http.put<T>(path, body).then((r) => r.data),
	delete: <T>(path: string) => http.delete<T>(path).then((r) => r.data),
};

/**
 * Downloads a binary response (e.g. a generated .xlsx export) and saves it
 * through the browser, reusing the same authenticated axios instance as the
 * rest of the API client. Falls back to `fallbackFilename` if the server
 * doesn't send a Content-Disposition filename.
 */
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
	const res = await http.get(path, { responseType: 'blob' });
	const disposition = res.headers['content-disposition'] as string | undefined;
	const match = disposition?.match(/filename="?([^"]+)"?/);
	const filename = match?.[1] || fallbackFilename;

	const url = window.URL.createObjectURL(res.data as Blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
}
