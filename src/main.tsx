import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/i18n";
import { PetApp } from "@/pet/pet-app";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PetApp />
  </React.StrictMode>,
);

const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
if (!isLocalPreview) {
  void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
