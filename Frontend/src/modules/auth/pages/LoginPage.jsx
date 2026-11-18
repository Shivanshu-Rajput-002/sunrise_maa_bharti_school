import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarRange, Lock, LogIn, User } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import Button from '../../../components/common/Button';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { APP_NAME, BrandIcon, homePath } from '../../../constants/menu';
import { selectAuth, setCredentials } from '../../../store/slices/authSlice';
import { setSession } from '../../../store/slices/scopeSlice';
import { useGetLoginOptionsQuery, useLoginMutation } from '../services/authApi';

const schema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  sessionId: z.coerce.number({ message: 'Select a session' }).int().positive('Select a session'),
});

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useSelector(selectAuth);
  const { data: options, isLoading: optionsLoading, isError: optionsError } = useGetLoginOptionsQuery();
  const [login, { isLoading, error }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { username: '', password: '', sessionId: '' } });

  // Pre-select the current session
  useEffect(() => {
    if (options?.currentSessionId && !getValues('sessionId')) setValue('sessionId', String(options.currentSessionId));
  }, [options, setValue, getValues]);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = async (values) => {
    try {
      const data = await login(values).unwrap();
      dispatch(setSession(data.sessionId));
      dispatch(setCredentials(data));
      navigate(location.state?.from || homePath(data.permissions), { replace: true });
    } catch {
      /* error rendered below */
    }
  };

  const sessionOptions = (options?.sessions ?? []).map((s) => ({
    value: s.id,
    label: `${s.name}${s.isCurrent ? '  (Current)' : ''}`,
  }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] shadow-neu-lg md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between bg-primary p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <BrandIcon className="h-6 w-6" />
            </div>
            <span className="text-lg font-semibold">Sunrise ERP</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight">{APP_NAME}</h1>
            <p className="mt-3 text-sm text-white/80">
              Students, fees, attendance, exams and reports — session-wise, for Hindi and English medium.
            </p>
          </div>
          <p className="text-xs text-white/60">© {new Date().getFullYear()} Sunrise Maa Bharti School</p>
        </div>

        {/* Form */}
        <div className="bg-base p-8 sm:p-10">
          <div className="mb-8 md:hidden">
            <div className="neu-card mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-primary">
              <BrandIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-muted">{APP_NAME}</p>
          </div>
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in and choose the academic session to work in.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <Input
              label="Username"
              icon={User}
              autoComplete="username"
              autoFocus
              {...register('username')}
              error={errors.username?.message}
            />
            <Input
              label="Password"
              type="password"
              icon={Lock}
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
            />
            <Select
              label="Academic session"
              placeholder={optionsLoading ? 'Loading sessions…' : 'Select session'}
              options={sessionOptions}
              {...register('sessionId')}
              error={errors.sessionId?.message || (optionsError ? 'Could not load sessions — is the server running?' : undefined)}
            />

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm text-danger shadow-neu-in-sm" role="alert">
                {error.message}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={isLoading} className="w-full justify-center">
              Sign in
            </Button>
          </form>

          <p className="mt-6 flex items-center gap-2 text-xs text-muted">
            <CalendarRange className="h-3.5 w-3.5" /> You can switch session and medium anytime from the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
