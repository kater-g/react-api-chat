import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { validateConfig } from "@/config/api";

import "@/styles/index.css";

try {
  validateConfig();
} catch (error) {
  console.error(error);
  const errorScreen = document.createElement("div");
  errorScreen.style.cssText =
    "padding: 20px; font-family: monospace; background: #fee; color: #c33;";

  const title = document.createElement("h2");
  title.textContent = "Ошибка конфигурации";

  const description = document.createElement("p");
  description.textContent =
    error instanceof Error ? error.message : String(error);

  errorScreen.append(title, description);
  document.body.replaceChildren(errorScreen);
  throw error;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
