import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { DEMO_CONTRACT_ID } from "@/demo/sampleContract";
import { CLERK_ENABLED } from "@/lib/auth";
import ContractDetail from "@/pages/ContractDetail";
import Dashboard from "@/pages/Dashboard";
import Landing from "@/pages/Landing";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {CLERK_ENABLED ? (
        <>
          <Route path="/sign-in/*" element={<SignIn />} />
          <Route path="/sign-up/*" element={<SignUp />} />
        </>
      ) : (
        <>
          <Route path="/sign-in/*" element={<Navigate to="/demo" replace />} />
          <Route path="/sign-up/*" element={<Navigate to="/demo" replace />} />
        </>
      )}
      <Route element={<AppShell />}>
        <Route path="/demo" element={<ContractDetail contractId={DEMO_CONTRACT_ID} />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contracts/:id" element={<ContractDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
