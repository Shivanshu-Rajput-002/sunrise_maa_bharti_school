import { Toaster } from 'react-hot-toast';
import AppRoutes from './app/routes/AppRoutes';
import AuthBootstrap from './app/AuthBootstrap';
import ErrorBoundary from './components/common/ErrorBoundary';
import PdfViewer from './components/common/PdfViewer';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthBootstrap>
        <AppRoutes />
        <PdfViewer />
      </AuthBootstrap>
      <Toaster
        position="top-right"
        toastOptions={{
          className: '!bg-base !text-ink !shadow-neu !rounded-xl !text-sm',
          duration: 3500,
        }}
      />
    </ErrorBoundary>
  );
}
