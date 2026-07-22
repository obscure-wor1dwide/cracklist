import React from "react";
import ReactDOM from "react-dom/client";
import Cracklist from "./Cracklist.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Cracklist />
    </ErrorBoundary>
  </React.StrictMode>
);
