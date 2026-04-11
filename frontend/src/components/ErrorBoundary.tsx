import React from 'react';
import { cn } from '@/lib/utils';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return;

    const { resetKeys } = this.props;
    const prevResetKeys = prevProps.resetKeys;

    if (!resetKeys || !prevResetKeys) return;

    const hasChanged = resetKeys.some((key, i) => key !== prevResetKeys[i]);
    if (hasChanged) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg',
            'bg-zinc-900 border border-zinc-700 p-6 text-center'
          )}>
          <p className="text-sm font-medium text-zinc-200">Something went wrong</p>
          {this.state.error && (
            <p className="text-xs text-zinc-400 max-w-xs truncate">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            className={cn(
              'mt-1 rounded-md px-4 py-1.5 text-sm font-medium',
              'bg-zinc-700 hover:bg-zinc-600 text-white transition-colors'
            )}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
