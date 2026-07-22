import { Component, type ReactNode } from 'react';

/**
 * Last line of defence: a render/effect crash must degrade into a visible,
 * reloadable error card — never a silent blank page. (The blank-page
 * navigation bug shipped precisely because nothing caught the throw.)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center space-y-4">
        <h1 className="font-display font-bold text-2xl text-navy">
          Something broke. / कुछ टूट गया।
        </h1>
        <p className="text-sm text-sub font-mono break-all">{String(this.state.error)}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Reload / फिर लोड करें
        </button>
      </div>
    );
  }
}
