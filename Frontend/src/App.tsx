import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import { DoctorLayout } from './components/layout/DoctorLayout';
import { PatientLayout } from './components/layout/PatientLayout';

// Auth Pages
import { Login } from './pages/auth/Login';
import { SignUp } from './pages/auth/SignUp';

// Doctor Pages
import { DoctorHome } from './pages/doctor/DoctorHome';
import { DoctorPatients } from './pages/doctor/DoctorPatients';
import { DoctorAddPatient } from './pages/doctor/DoctorAddPatient';
import { DoctorPatientDetail } from './pages/doctor/DoctorPatientDetail';
import { DoctorPatientMedicines } from './pages/doctor/DoctorPatientMedicines';
import { DoctorAppointments } from './pages/doctor/DoctorAppointments';
import { DoctorReports } from './pages/doctor/DoctorReports';
import { DoctorReportDetail } from './pages/doctor/DoctorReportDetail';
import { DoctorPatientQuestions } from './pages/doctor/DoctorPatientQuestions';
import { DoctorProfile } from './pages/doctor/DoctorProfile';

// Patient Pages
import { PatientHome } from './pages/patient/PatientHome';
import { PatientUploadReport } from './pages/patient/PatientUploadReport';
import { PatientMyReports } from './pages/patient/PatientMyReports';
import { PatientReportDetail } from './pages/patient/PatientReportDetail';
import { PatientMedicines } from './pages/patient/PatientMedicines';
import { PatientAppointments } from './pages/patient/PatientAppointments';
import { PatientAskDoctor } from './pages/patient/PatientAskDoctor';
import { PatientDoctors } from './pages/patient/PatientDoctors';
import { PatientSettings } from './pages/patient/PatientSettings';
import { PatientProfile } from './pages/patient/PatientProfile';
import { PatientOnboarding } from './pages/patient/PatientOnboarding';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminPortal } from './pages/admin/AdminPortal';
import { RealtimeNotificationBanner } from './components/common/RealtimeNotificationBanner';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <RealtimeNotificationBanner />
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
    </BrowserRouter>
  );
};

export default App;
