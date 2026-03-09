import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ContractDetail from "@/pages/ContractDetail";
import Dashboard from "@/pages/Dashboard";
import Landing from "@/pages/Landing";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contracts/:id" element={<ContractDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
