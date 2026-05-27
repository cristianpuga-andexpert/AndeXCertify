import React from 'react';
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
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-surface font-sans overflow-x-hidden">
      <Routes>
        {/* Public Certificate Validation Routes */}
        <Route path="/validar/:certificateId" element={<CertificateValidation />} />
        <Route path="/validate/:certificateId" element={<CertificateValidation />} />
        <Route path="/verify/:certificateId" element={<CertificateValidation />} />
        <Route path="/validar" element={<CertificateValidation />} />
        <Route path="/validate" element={<CertificateValidation />} />
        <Route path="/verify" element={<CertificateValidation />} />

        {/* Protected Routes */}
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
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
