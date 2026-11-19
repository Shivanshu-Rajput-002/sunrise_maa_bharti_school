import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarRange, Lock, LogIn, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import Button from '../../../components/common/Button';
import Input from '../../../components/form/Input';
import { APP_NAME, BrandIcon, homePath } from '../../../constants/menu';
import { selectAuth, setCredentials } from '../../../store/slices/authSlice';
import { setSession } from '../../../store/slices/scopeSlice';
import { useGetLoginOptionsQuery, useLoginMutation } from '../services/authApi';

/** School logo from Settings (public login options); falls back to the app icon */
function BigLogo({ path, name, className, iconClass }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-3xl bg-white shadow-lg ${className}`}>
      {path && !broken ? (
        <img src={`/uploads/${path}`} alt={name || 'School logo'} className="h-full w-full object-contain p-2" onError={() => setBroken(true)} />
      ) : (
        <BrandIcon className={`text-primary ${iconClass}`} />
      )}
    </div>
  );
}

const schema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useSelector(selectAuth);
  const [login, { isLoading, error }] = useLoginMutation();
  const { data: options } = useGetLoginOptionsQuery();
  const school = options?.school;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = async (values) => {
    try {
      // Server starts the user in the current session; it can be switched from the dashboard
      const data = await login(values).unwrap();
      dispatch(setSession(data.sessionId));
      dispatch(setCredentials(data));
      navigate(location.state?.from || homePath(data.permissions), { replace: true });
    } catch {
      /* error rendered below */
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] shadow-neu-lg md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col items-center justify-between gap-6 bg-primary p-10 text-center text-white md:flex">
          <span className="self-start text-sm font-semibold text-white/80">Sunrise ERP</span>
          <div className="flex flex-col items-center">
            <BigLogo path={school?.logoPath} name={school?.name} className="h-44 w-44 lg:h-52 lg:w-52" iconClass="h-20 w-20" />
            <h1 className="mt-6 text-3xl font-semibold leading-tight">{school?.name || APP_NAME}</h1>
            {school?.tagline && <p className="mt-2 text-sm text-white/85">{school.tagline}</p>}
            <p className="mt-4 max-w-xs text-sm text-white/70">
              Students, fees, attendance, exams and reports — session-wise, for Hindi and English medium.
            </p>
          </div>
          <p className="text-xs text-white/60">© {new Date().getFullYear()} {school?.name || 'Sunrise Maa Bharti School'}</p>
        </div>

        {/* Form */}
        <div className="bg-base p-8 sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center md:hidden">
            <BigLogo path={school?.logoPath} name={school?.name} className="h-28 w-28" iconClass="h-12 w-12" />
            <p className="mt-3 text-lg font-semibold">{school?.name || APP_NAME}</p>
            {school?.tagline && <p className="text-xs text-muted">{school.tagline}</p>}
          </div>
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in to continue.</p>

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
            <CalendarRange className="h-3.5 w-3.5" /> You start in the current session — switch session and medium anytime from the top bar.
          </p>
        </div>
      </div>
    </div>
  );
}
