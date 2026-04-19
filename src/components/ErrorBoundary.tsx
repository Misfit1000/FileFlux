import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px] bg-[#1e293b]/60 backdrop-blur-xl rounded-[2rem] border border-red-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="w-24 h-24 bg-red-500/20 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)] border border-red-500/50">
            <AlertTriangle className="w-12 h-12 text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-md">Oops! Something went wrong.</h2>
          <p className="text-red-200 mb-8 max-w-md font-medium text-lg drop-shadow-sm">
            {this.state.error?.message || "An unexpected error occurred during the conversion process."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500 text-white rounded-2xl font-bold shadow-[0_8px_25px_rgba(239,68,68,0.4)] flex items-center transition-all hover:-translate-y-1 border border-white/20"
          >
            <RefreshCw className="w-6 h-6 mr-2" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
