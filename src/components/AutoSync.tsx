"use client";

import { useEffect } from "react";

export default function AutoSync() {
  useEffect(() => {
    if (sessionStorage.getItem("garmin-auto-sync") === "done") return;
    sessionStorage.setItem("garmin-auto-sync", "done");

    fetch("/api/garmin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.added === "number" && data.added > 0) {
          window.location.reload();
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
