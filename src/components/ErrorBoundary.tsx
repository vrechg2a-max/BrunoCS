import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { FirestoreErrorInfo } from '../lib/firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  firestoreError: FirestoreErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
    firestoreError: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    let parsed: FirestoreErrorInfo | null = null;
    try {
      const candidate = JSON.parse(error.message) as FirestoreErrorInfo;
      if (candidate && typeof candidate.error === 'string' && candidate.operationType) {
        parsed = candidate;
      }
    } catch {
      // Standard non-JSON runtime error
    }

    return {
      hasError: true,
      errorMessage: parsed ? parsed.error : error.message,
      firestoreError: parsed,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', firestoreError: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 text-red-700 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  Erro de operação no sistema
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {this.state.firestoreError
                    ? 'A operação no Firestore foi recusada pelas regras de segurança ou perdeu conectividade.'
                    : 'Ocorreu uma falha inesperada ao renderizar esta visualização.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-words">
              {this.state.firestoreError ? (
                <div className="space-y-1">
                  <div>Operação: {this.state.firestoreError.operationType}</div>
                  <div>Caminho: {this.state.firestoreError.path || '—'}</div>
                  <div>Detalhe: {this.state.firestoreError.error}</div>
                </div>
              ) : (
                this.state.errorMessage
              )}
            </div>

            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
