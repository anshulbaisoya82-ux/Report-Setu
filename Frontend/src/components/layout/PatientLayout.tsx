import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Home, FileText, UploadCloud, Pill, Salad, Calendar, MessageSquare, UserCheck, User } from 'lucide-react';
import { AppShell, NavItem } from './AppShell';
import { connectionsApi } from '../../api';
import { useStore } from '../../store/useStore';

export const PatientLayout: React.FC = () => {
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const currentUser = useStore((s) => s.currentUser);

  useEffect(() => {
    connectionsApi
      .getPendingRequests()
      .then((res) => setPendingCount(res?.requests?.length || 0))
      .catch(() => {});
  }, [pathname]);

  // Figma order, plus "My doctors" and "My profile" which exist in code and backend.
  const items: NavItem[] = [
    { name: 'Home', path: '/patient', icon: Home, exact: true, primary: true },
    { name: 'My reports', path: '/patient/reports', icon: FileText, primary: true },
    { name: 'Upload report', path: '/patient/upload', icon: UploadCloud, primary: true },
    { name: 'Medicines', path: '/patient/medicines', icon: Pill, primary: true },
    { name: 'Food check', path: '/patient/food-check', icon: Salad },
    { name: 'Appointments', path: '/patient/appointments', icon: Calendar },
    { name: 'Ask doctor', path: '/patient/ask-doctor', icon: MessageSquare, primary: true },
    { name: 'My doctors', path: '/patient/doctors', icon: UserCheck, badge: pendingCount || undefined },
    { name: 'Profile', path: '/patient/profile', icon: User },
  ];

  return (
    <AppShell
      items={items}
      settingsPath="/patient/settings"
      privacyNote="Your reports are visible only to you and the doctors you connect."
      account={currentUser?.name ? { name: currentUser.name, detail: currentUser.rsId } : undefined}
      fullBleed={(p) => p.startsWith('/patient/ask-doctor')}
    />
  );
};
