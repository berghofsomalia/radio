import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Archive from "./Archive";
import AdminApp from "./AdminApp";
import "./styles.css";
import "./admin.css";

function Router() {
  const [admin, setAdmin] = useState(window.location.hash.startsWith("#/admin"));
  useEffect(() => {
    const update = () => setAdmin(window.location.hash.startsWith("#/admin"));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return admin ? <AdminApp /> : <Archive />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
);
