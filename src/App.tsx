import { Route, Routes } from 'react-router-dom';
import {
  RequireAdmin,
  RequireAuth,
  RootRedirect,
} from './components/RouteGuards';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PrintQrPage } from './pages/PrintQrPage';
import { ScanPage } from './pages/ScanPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/scan" element={<ScanPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<RequireAdmin />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/print/:id" element={<PrintQrPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
