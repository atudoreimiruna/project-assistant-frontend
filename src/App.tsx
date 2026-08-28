import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute, RootRedirect } from './components/ProtectedRoute/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { RegisterPage } from './pages/RegisterPage/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage/DashboardPage';
import { CoursePage } from './pages/CoursePage/CoursePage';
import { TeamPage } from './pages/TeamPage/TeamPage';
import { StudentPage } from './pages/StudentPage/StudentPage';

export default function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<ErrorBoundary>
					<Routes>
						{/* Entry point: send people wherever their session says they belong */}
						<Route
							path='/'
							element={<RootRedirect />}
						/>

						{/* Public, but pointless once signed in */}
						<Route element={<PublicOnlyRoute />}>
							<Route
								path='/login'
								element={<LoginPage />}
							/>
							<Route
								path='/register'
								element={<RegisterPage />}
							/>
						</Route>

						{/* Public regardless of session — a signed-in user may still be
                following a reset link from their inbox. */}
						<Route
							path='/forgot-password'
							element={<ForgotPasswordPage />}
						/>
						<Route
							path='/reset-password/:token'
							element={<ResetPasswordPage />}
						/>

						{/* Protected */}
						<Route element={<ProtectedRoute />}>
							<Route
								path='/dashboard'
								element={<DashboardPage />}
							/>
							<Route
								path='/courses/:id'
								element={<CoursePage />}
							/>
							<Route
								path='/teams/:id'
								element={<TeamPage />}
							/>
							<Route
								path='/teams/:teamId/students/:studentId'
								element={<StudentPage />}
							/>
						</Route>

						{/* Fallback */}
						<Route
							path='*'
							element={
								<Navigate
									to='/'
									replace
								/>
							}
						/>
					</Routes>
				</ErrorBoundary>
			</AuthProvider>
		</BrowserRouter>
	);
}
