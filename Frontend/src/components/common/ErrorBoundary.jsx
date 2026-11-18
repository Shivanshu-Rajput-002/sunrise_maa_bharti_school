import { Component } from 'react';

/** Last line of defence: a render crash shows a friendly screen instead of a blank page */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crash:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-6">
        <div className="neu-card max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">The page hit an unexpected error. Reloading usually fixes it.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-neu-sm"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
