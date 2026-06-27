import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type AuthResponse, type LoginPayload, type RegisterPayload } from '../api/auth';

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  teacher: Teacher | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hydrateTeacher(): Teacher | null {
  try {
    const raw = localStorage.getItem('teacher');
    return raw ? (JSON.parse(raw) as Teacher) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(hydrateTeacher);
  const [isLoading, setIsLoading] = useState(false);

  // Keep localStorage in sync
  useEffect(() => {
    if (teacher) {
      localStorage.setItem('teacher', JSON.stringify(teacher));
    } else {
      localStorage.removeItem('teacher');
    }
  }, [teacher]);

  const persist = useCallback((res: AuthResponse) => {
    localStorage.setItem('token', res.token);
    setTeacher(res.teacher);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setIsLoading(true);
      try {
        const res = await authApi.login(payload);
        persist(res);
      } finally {
        setIsLoading(false);
      }
    },
    [persist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setIsLoading(true);
      try {
        const res = await authApi.register(payload);
        persist(res);
      } finally {
        setIsLoading(false);
      }
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setTeacher(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      teacher,
      isAuthenticated: teacher !== null,
      isLoading,
      login,
      register,
      logout,
    }),
    [teacher, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
