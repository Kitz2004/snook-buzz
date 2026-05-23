import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";

import AuthPage    from "./pages/AuthPage";
import GroupPage   from "./pages/GroupPage";
import RecordMatch from "./pages/RecordMatch";
import Players     from "./pages/Players";
import History     from "./pages/History";
import BottomNav   from "./BottomNav";

function Gate() {
  const { session, group, loading } = useAuth();

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0a0c10", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"system-ui", color:"#00e5a0", fontSize:14, letterSpacing:"0.1em" }}>
      🔴 Loading…
    </div>
  );

  if (!session) return <AuthPage />;
  if (!group)   return <GroupPage />;

  return (
    <>
      <div style={{ paddingBottom:"70px" }}>
        <Routes>
          <Route path="/"        element={<RecordMatch />} />
          <Route path="/players" element={<Players />} />
          <Route path="/history" element={<History />} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </BrowserRouter>
);
