import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#fee2e2', color: '#991b1b', height: '100vh', width: '100vw', zIndex: 999999, position: 'fixed', top: 0, left: 0, overflow: 'auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Something went wrong.</h1>
          <p style={{ margin: '1rem 0' }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ background: '#fef2f2', padding: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
