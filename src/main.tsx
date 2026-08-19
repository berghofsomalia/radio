import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Archive from "./Archive";
import AdminApp from "./AdminApp";
import "./styles.css";
import "./admin.css";

function isAdminRoute() {
  const pathname = window.location.pathname.replace(/\/+$/, "");
  return pathname.endsWith("/admin") || window.location.hash.startsWith("#/admin");
}

function Router() {
  const [admin, setAdmin] = useState(isAdminRoute);
  useEffect(() => {
    const update = () => setAdmin(isAdminRoute());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return admin ? <AdminApp /> : <Archive />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
);
