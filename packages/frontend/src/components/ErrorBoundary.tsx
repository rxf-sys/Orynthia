import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="max-w-md w-full rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">
            Etwas ist schiefgelaufen
          </h1>
          <p className="text-sm text-[var(--ink-dim)] mb-6">
            Die Seite konnte nicht geladen werden. Du kannst es noch einmal versuchen oder
            die Seite neu laden.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-left text-xs bg-black/30 rounded p-3 mb-4 overflow-auto max-h-40 text-red-300">
              {this.state.error.message}
              {this.state.error.stack ? '\n\n' + this.state.error.stack : ''}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={this.reset}
              className="px-4 py-2 rounded-lg bg-[var(--indigo)] text-white text-sm font-medium hover:opacity-90"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm text-[var(--ink)] hover:bg-white/5"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      </div>
    );
  }
}
