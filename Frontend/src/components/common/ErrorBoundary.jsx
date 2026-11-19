import { Component } from 'react';

/** A lazy page file that no longer exists on the server (after a new version was deployed) */
const isChunkError = (e) => /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed|error loading dynamically imported module/i.test(String(e?.message ?? e));

/**
 * Catches render crashes and shows a friendly message instead of a blank page.
 * `inline` = inside the app shell (sidebar/header stay); otherwise full screen.
 * Give it a `resetKey` (e.g. the URL) so moving to another page clears the error.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crash:', error, info.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkError(error);
    const title = chunk ? 'A new version is available' : 'This page could not be shown';
    const text = chunk
      ? 'The software was updated. Reload the page to get the latest version.'
      : 'Something unexpected happened on this page. Reloading usually fixes it. If it keeps happening, tell the admin what you were doing.';

    const card = (
      <div className="neu-card max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={() => window.location.reload()} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-neu-sm">
            Reload page
          </button>
          {!chunk && (
            <button onClick={() => window.location.assign('/')} className="rounded-xl px-5 py-2.5 text-sm font-medium text-ink shadow-neu-sm">
              Go to home
            </button>
          )}
        </div>
      </div>
    );

    return this.props.inline ? (
      <div className="flex min-h-[50vh] items-center justify-center p-4">{card}</div>
    ) : (
      <div className="flex min-h-screen items-center justify-center bg-base p-6">{card}</div>
    );
  }
}
