import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import './Login.css';

export function Login() {
    const navigate = useNavigate();
    const { login, changePassword, isAuthenticated, user } = useAuth();

    const [step, setStep] = useState<'login' | 'changePassword'>(
        user?.must_change_password ? 'changePassword' : 'login'
    );

    // Login form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Change password form state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePasswordError, setChangePasswordError] = useState('');

    // Redirect if already authenticated and no password change needed
    if (isAuthenticated && !user?.must_change_password) {
        navigate('/dashboard', { replace: true });
        return null;
    }

    const handleLoginSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);

        const success = await login(username, password, remember);

        if (success) {
            // Check if user needs to change password
            const currentUser = JSON.parse(localStorage.getItem('carga_slack_user') || '{}');
            if (currentUser.must_change_password) {
                setStep('changePassword');
            } else {
                navigate('/dashboard', { replace: true });
            }
        } else {
            setLoginError('Usuário ou senha inválidos');
        }

        setIsLoading(false);
    };

    const handleChangePasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setChangePasswordError('');

        if (newPassword.length < 6) {
            setChangePasswordError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            setChangePasswordError('As senhas não coincidem');
            return;
        }

        setIsLoading(true);
        const success = await changePassword(newPassword);

        if (success) {
            navigate('/dashboard', { replace: true });
        } else {
            setChangePasswordError('Erro ao alterar senha. Tente novamente.');
        }

        setIsLoading(false);
    };

    const handleBackToLogin = () => {
        // Clear auth and go back to login
        localStorage.removeItem('carga_slack_token');
        localStorage.removeItem('carga_slack_user');
        setStep('login');
        setUsername('');
        setPassword('');
        window.location.reload();
    };

    return (
        <div className="login-page">
            {/* Animated Background */}
            <div className="login-background">
                <div className="gradient-orb gradient-orb-1"></div>
                <div className="gradient-orb gradient-orb-2"></div>
                <div className="gradient-orb gradient-orb-3"></div>
            </div>

            <div className="login-container">
                <div className="login-card">
                    {step === 'login' ? (
                        <div id="loginStep">
                            <div className="login-header">
                                <div className="logo">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ color: 'var(--color-primary)' }}>
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                    </svg>
                                </div>
                                <h1>Bem-vindo</h1>
                                <p>Faça login para acessar o painel</p>
                            </div>

                            <form onSubmit={handleLoginSubmit}>
                                <div className="form-group">
                                    <label htmlFor="username">Usuário</label>
                                    <div className="input-wrapper">
                                        <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        <input
                                            type="text"
                                            id="username"
                                            placeholder="Seu nome de usuário"
                                            required
                                            autoComplete="username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="password">Senha</label>
                                    <div className="input-wrapper">
                                        <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            placeholder="Sua senha"
                                            required
                                            autoComplete="current-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex={-1}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="form-options">
                                    <label className="checkbox-wrapper">
                                        <input
                                            type="checkbox"
                                            checked={remember}
                                            onChange={(e) => setRemember(e.target.checked)}
                                        />
                                        <span className="checkmark"></span>
                                        Lembrar-me
                                    </label>
                                </div>

                                {loginError && (
                                    <div className="error-message" style={{ display: 'block' }}>
                                        {loginError}
                                    </div>
                                )}

                                <button type="submit" className="btn btn-primary btn-login" disabled={isLoading}>
                                    <span>{isLoading ? 'Entrando...' : 'Entrar'}</span>
                                    {!isLoading && (
                                        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                            <polyline points="12 5 19 12 12 19"></polyline>
                                        </svg>
                                    )}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div id="changePasswordStep">
                            <div className="login-header">
                                <div className="logo">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ color: 'var(--color-primary)' }}>
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </div>
                                <h1>Nova Senha</h1>
                                <p>Por segurança, você precisa redefinir sua senha.</p>
                            </div>

                            <form onSubmit={handleChangePasswordSubmit}>
                                <div className="form-group">
                                    <label htmlFor="newPassword">Nova Senha</label>
                                    <div className="input-wrapper">
                                        <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                        <input
                                            type="password"
                                            id="newPassword"
                                            required
                                            minLength={6}
                                            placeholder="Mínimo 6 caracteres"
                                            autoComplete="new-password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirmar Senha</label>
                                    <div className="input-wrapper">
                                        <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            required
                                            placeholder="Repita a senha"
                                            autoComplete="new-password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {changePasswordError && (
                                    <div className="error-message" style={{ display: 'block', marginTop: '1rem', marginBottom: '1.5rem' }}>
                                        {changePasswordError}
                                    </div>
                                )}

                                <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ flex: 1 }}
                                        onClick={handleBackToLogin}
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-login"
                                        style={{ flex: 1 }}
                                        disabled={isLoading}
                                    >
                                        <span>{isLoading ? 'Atualizando...' : 'Atualizar'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="login-footer">
                        <p>© 2026 Carga Slack System. Todos os direitos reservados.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
