import { Loader2 } from 'lucide-react';

export default function Loader({ label = 'Loading…', fullScreen = false }) {
  const content = (
    <div className="flex flex-col items-center gap-3 text-muted" role="status">
      <div className="neu-card flex h-14 w-14 items-center justify-center rounded-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
  if (!fullScreen) return <div className="flex justify-center py-12">{content}</div>;
  return <div className="flex h-full min-h-screen items-center justify-center bg-base">{content}</div>;
}
