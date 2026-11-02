import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { UIProvider } from "./components/ui.jsx";
import "./styles.css";

// * Apply the saved theme before the first paint ("" = follow the system).
document.documentElement.dataset.theme = localStorage.getItem("dt_theme") || "";

createRoot(document.getElementById("root")).render(<BrowserRouter><UIProvider><App /></UIProvider></BrowserRouter>);
