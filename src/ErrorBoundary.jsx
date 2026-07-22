import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            padding: 16,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: 12,
            color: "#3A0D18",
            background: "#FFF3F5",
          }}
        >
          {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </pre>
      );
    }
    return this.props.children;
  }
}
