import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
declare global {
  interface Window {
    helper: {
      invoke: <T = any>(method: string, input?: unknown) => Promise<T>;
    };
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
