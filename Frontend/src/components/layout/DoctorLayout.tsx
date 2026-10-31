import React, { useEffect } from 'react';
import { Home, Users, FileText, Calendar, MessageSquare, User } from 'lucide-react';
import { AppShell, NavItem } from './AppShell';
import { useStore } from '../../store/useStore';

export const DoctorLayout: React.FC = () => {
  const { questionThreads, fetchQuestionThreads, doctorInfo } = useStore();

  useEffect(() => {
    void fetchQuestionThreads();
  }, [fetchQuestionThreads]);

  const unread = questionThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  // Figma order (Home, Patients, Reports, Appointments). "Follow-ups" from Figma is not
  // shown because the backend has no follow-ups API yet; "Patient questions" exists in code.
  const items: NavItem[] = [
    { name: 'Home', path: '/doctor', icon: Home, exact: true, primary: true },
    { name: 'Patients', path: '/doctor/patients', icon: Users, primary: true },
    { name: 'Reports', path: '/doctor/reports', icon: FileText, primary: true },
    { name: 'Appointments', path: '/doctor/appointments', icon: Calendar, primary: true },
    { name: 'Patient questions', path: '/doctor/questions', icon: MessageSquare, badge: unread, primary: true },
    { name: 'Profile', path: '/doctor/profile', icon: User },
  ];

  return <AppShell items={items} settingsPath="/doctor/settings" privacyNote="Patient reports are visible only to you and your clinic."
      account={doctorInfo.name ? { name: doctorInfo.name, detail: doctorInfo.specialty } : undefined}
    />;
};
