import React, { Suspense, lazy } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isDemoMode } from './demo/flags';
import { PageLoader } from './components/ui/PageLoader';
import { DemoBadge } from './components/common/DemoBadge';
import { ToastViewport } from './components/ui/Toast';

// The hosted demo is served as static files, so it uses hash URLs; real deployments keep clean URLs.
const Router = isDemoMode ? HashRouter : BrowserRouter;

// Layouts
import { DoctorLayout } from './components/layout/DoctorLayout';
import { PatientLayout } from './components/layout/PatientLayout';

// Auth Pages
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const SignUp = lazy(() => import('./pages/auth/SignUp').then((m) => ({ default: m.SignUp })));

// Doctor Pages
const DoctorHome = lazy(() => import('./pages/doctor/DoctorHome').then((m) => ({ default: m.DoctorHome })));
const DoctorPatients = lazy(() => import('./pages/doctor/DoctorPatients').then((m) => ({ default: m.DoctorPatients })));
const DoctorAddPatient = lazy(() => import('./pages/doctor/DoctorAddPatient').then((m) => ({ default: m.DoctorAddPatient })));
const DoctorPatientDetail = lazy(() => import('./pages/doctor/DoctorPatientDetail').then((m) => ({ default: m.DoctorPatientDetail })));
const DoctorPatientMedicines = lazy(() => import('./pages/doctor/DoctorPatientMedicines').then((m) => ({ default: m.DoctorPatientMedicines })));
const DoctorAppointments = lazy(() => import('./pages/doctor/DoctorAppointments').then((m) => ({ default: m.DoctorAppointments })));
const DoctorReports = lazy(() => import('./pages/doctor/DoctorReports').then((m) => ({ default: m.DoctorReports })));
const DoctorReportDetail = lazy(() => import('./pages/doctor/DoctorReportDetail').then((m) => ({ default: m.DoctorReportDetail })));
const DoctorPatientQuestions = lazy(() => import('./pages/doctor/DoctorPatientQuestions').then((m) => ({ default: m.DoctorPatientQuestions })));
const DoctorProfile = lazy(() => import('./pages/doctor/DoctorProfile').then((m) => ({ default: m.DoctorProfile })));

// Patient Pages
const PatientHome = lazy(() => import('./pages/patient/PatientHome').then((m) => ({ default: m.PatientHome })));
const PatientUploadReport = lazy(() => import('./pages/patient/PatientUploadReport').then((m) => ({ default: m.PatientUploadReport })));
const PatientMyReports = lazy(() => import('./pages/patient/PatientMyReports').then((m) => ({ default: m.PatientMyReports })));
const PatientReportDetail = lazy(() => import('./pages/patient/PatientReportDetail').then((m) => ({ default: m.PatientReportDetail })));
const PatientMedicines = lazy(() => import('./pages/patient/PatientMedicines').then((m) => ({ default: m.PatientMedicines })));
const PatientAppointments = lazy(() => import('./pages/patient/PatientAppointments').then((m) => ({ default: m.PatientAppointments })));
const PatientAskDoctor = lazy(() => import('./pages/patient/PatientAskDoctor').then((m) => ({ default: m.PatientAskDoctor })));
const PatientDoctors = lazy(() => import('./pages/patient/PatientDoctors').then((m) => ({ default: m.PatientDoctors })));
const PatientSettings = lazy(() => import('./pages/patient/PatientSettings').then((m) => ({ default: m.PatientSettings })));
const PatientProfile = lazy(() => import('./pages/patient/PatientProfile').then((m) => ({ default: m.PatientProfile })));
const PatientOnboarding = lazy(() => import('./pages/patient/PatientOnboarding').then((m) => ({ default: m.PatientOnboarding })));
import { ProtectedRoute } from './components/auth/ProtectedRoute';
const AdminPortal = lazy(() => import('./pages/admin/AdminPortal').then((m) => ({ default: m.AdminPortal })));
import { RealtimeNotificationBanner } from './components/common/RealtimeNotificationBanner';

export const App: React.FC = () => {
  return (
    <Router>
      <RealtimeNotificationBanner />
      {isDemoMode && <DemoBadge />}
      <ToastViewport />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Doctor Portal Routes */}
        <Route path="/doctor" element={<ProtectedRoute role="doctor"><DoctorLayout /></ProtectedRoute>}>
          <Route index element={<DoctorHome />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="patients/new" element={<DoctorAddPatient />} />
          <Route path="add-patient" element={<DoctorAddPatient />} />
          <Route path="patients/:patientId" element={<DoctorPatientDetail />} />
          <Route path="patients/:patientId/medicines" element={<DoctorPatientMedicines />} />
          <Route path="patients/:patientId/appointments" element={<DoctorPatientDetail initialTab="Appointments" />} />
          <Route path="patients/:patientId/reports" element={<DoctorPatientDetail initialTab="Lab Reports" />} />
          <Route path="appointments" element={<DoctorAppointments />} />
          <Route path="reports" element={<DoctorReports />} />
          <Route path="reports/:reportId" element={<DoctorReportDetail />} />
          <Route path="questions" element={<DoctorPatientQuestions />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="settings" element={<DoctorProfile />} />
        </Route>

        {/* Patient Portal Routes */}
        <Route path="/patient" element={<ProtectedRoute role="patient"><PatientLayout /></ProtectedRoute>}>
          <Route index element={<PatientHome />} />
          <Route path="upload" element={<PatientUploadReport />} />
          <Route path="reports" element={<PatientMyReports />} />
          <Route path="reports/:reportId" element={<PatientReportDetail />} />
          <Route path="medicines" element={<PatientMedicines />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="ask-doctor" element={<PatientAskDoctor />} />
          <Route path="doctors" element={<PatientDoctors />} />
          <Route path="requests" element={<PatientDoctors />} />
          <Route path="profile" element={<PatientProfile />} />
          <Route path="settings" element={<PatientSettings />} />
        </Route>
        <Route path="/patient/onboarding" element={<ProtectedRoute role="patient"><PatientOnboarding /></ProtectedRoute>} />

        {/* Admin Portal Route */}
        <Route path="/admin" element={<AdminPortal />} />

        {/* Root Redirect to Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
