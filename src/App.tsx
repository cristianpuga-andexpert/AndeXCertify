import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CourseList } from './pages/CourseList';
import { NewCourse } from './pages/NewCourse';
import { EditCourse } from './pages/EditCourse';
import { StudentList } from './pages/StudentList';
import { CertificateList } from './pages/CertificateList';
import { SettingsInstitutional } from './pages/SettingsInstitutional';
import { SettingsRepresentatives } from './pages/SettingsRepresentatives';
import { Templates } from './pages/Templates';
import { CertificateValidation } from './pages/CertificateValidation';
import { UserManagement } from './pages/UserManagement';
import { SetPassword } from './pages/SetPassword';
import { ResetPassword } from './pages/ResetPassword';
import { SuperAdminSettings } from './pages/SuperAdminSettings';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ThemeProvider } from './lib/theme-context';
import { RoleProvider } from './lib/role-context';
import { LoginView } from './components/LoginView';
import { SuperAdminGuard } from './components/SuperAdminGuard';
import { Sidebar } from './components/Sidebar';
import { SuperAdmin } from './pages/SuperAdmin';
import { SuperAdminTenants } from './pages/SuperAdminTenants';
import { SuperAdminNewTenant } from './pages/SuperAdminNewTenant';
import { api } from './lib/api';
import { OrganizationSettings } from './types';
import { applyBrandColor, DEFAULT_BRAND_COLOR } from './lib/colorUtils';

function AppContent() {
  const { user } = useAuth();

  // Apply the saved brand color from settings whenever a user logs in / out
  useEffect(() => {
    if (!user) {
      applyBrandColor(DEFAULT_BRAND_COLOR);
      return;
    }
    api.get<OrganizationSettings>('/api/settings')
      .then((s) => { applyBrandColor(s?.brandColor); })
      .catch(() => { applyBrandColor(DEFAULT_BRAND_COLOR); });
  }, [user]);

  return (
    <div className="min-h-screen bg-surface font-sans overflow-x-hidden">
      <Routes>
        {/* Public invitation / password routes */}
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Public Certificate Validation Routes */}
        <Route path="/validar/:certificateId" element={<CertificateValidation />} />
        <Route path="/validate/:certificateId" element={<CertificateValidation />} />
        <Route path="/verify/:certificateId" element={<CertificateValidation />} />
        <Route path="/validar" element={<CertificateValidation />} />
        <Route path="/validate" element={<CertificateValidation />} />
        <Route path="/verify" element={<CertificateValidation />} />

        {/* Superadmin Routes — full-screen layout, no Sidebar */}
        <Route path="/superadmin" element={
          user ? (
            <SuperAdminGuard><SuperAdmin /></SuperAdminGuard>
          ) : (
            <LoginView />
          )
        } />
        <Route path="/superadmin/tenants" element={
          user ? (
            <SuperAdminGuard><SuperAdminTenants /></SuperAdminGuard>
          ) : (
            <LoginView />
          )
        } />
        <Route path="/superadmin/tenants/new" element={
          user ? (
            <SuperAdminGuard><SuperAdminNewTenant /></SuperAdminGuard>
          ) : (
            <LoginView />
          )
        } />
        <Route path="/superadmin/settings" element={
          user ? (
            <SuperAdminGuard><SuperAdminSettings /></SuperAdminGuard>
          ) : (
            <LoginView />
          )
        } />

        {/* Protected App Routes */}
        <Route path="/*" element={
          user ? (
            <div className="flex w-full h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 bg-surface overflow-y-auto">
                <Routes>
                  <Route path="/" element={<CourseList />} />
                  <Route path="/courses/new" element={<NewCourse />} />
                  <Route path="/courses/edit/:courseId" element={<EditCourse />} />
                  <Route path="/courses/:courseId/students" element={<StudentList />} />
                  <Route path="/courses/:courseId/certificates" element={<CertificateList />} />
                  <Route path="/settings" element={<Navigate to="/settings/institutional" replace />} />
                  <Route path="/settings/institutional" element={<SettingsInstitutional />} />
                  <Route path="/settings/representatives" element={<SettingsRepresentatives />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/users" element={<UserManagement />} />
                </Routes>
              </main>
            </div>
          ) : (
            <LoginView />
          )
        } />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <RoleProvider>
            <AppContent />
          </RoleProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
