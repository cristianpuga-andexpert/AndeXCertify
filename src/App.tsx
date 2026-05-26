import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CourseList } from './pages/CourseList';
import { NewCourse } from './pages/NewCourse';
import { EditCourse } from './pages/EditCourse';
import { StudentList } from './pages/StudentList';
import { CertificateList } from './pages/CertificateList';
import { Settings } from './pages/Settings';
import { Templates } from './pages/Templates';
import { CertificateValidation } from './pages/CertificateValidation';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginView } from './components/LoginView';
import { logOut } from './lib/firebase';
import { LogOut, User as UserIcon } from 'lucide-react';

import { Sidebar } from './components/Sidebar';

function AppContent() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-surface font-sans overflow-x-hidden">
      <Routes>
        {/* Public Validation Route */}
        <Route path="/validar/:certificateId" element={<CertificateValidation />} />
        <Route path="/validate/:certificateId" element={<CertificateValidation />} />
        <Route path="/verify/:certificateId" element={<CertificateValidation />} />
        
        {/* Legacy / catch internal mistakes */}
        <Route path="/validar" element={<CertificateValidation />} />
        <Route path="/validate" element={<CertificateValidation />} />
        <Route path="/verify" element={<CertificateValidation />} />
        
        {/* Protected Routes */}
        <Route path="/*" element={
          user ? (
            <div className="flex w-full min-h-screen">
              <Sidebar />
              <main className="flex-1 bg-surface relative">
                <div className="max-w-7xl mx-auto">
                  <Routes>
                    <Route path="/" element={<CourseList />} />
                    <Route path="/courses/new" element={<NewCourse />} />
                    <Route path="/courses/edit/:courseId" element={<EditCourse />} />
                    <Route path="/courses/:courseId/students" element={<StudentList />} />
                    <Route path="/courses/:courseId/certificates" element={<CertificateList />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/templates" element={<Templates />} />
                  </Routes>
                </div>
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
