import { useEffect } from 'react';
import { FeedbackProvider, Skeleton, applyMotionPreference } from './motion';
import { RouterProvider, useRouter } from './store/router';
import { StoreProvider, useStore } from './store/store';
import { UiStateProvider } from './store/ui';
import { TabBar } from './ui/common';
import { HomeScreen } from './screens/HomeScreen';
import { CanyonScreen } from './screens/CanyonScreen';
import { AvailabilityScreen } from './screens/AvailabilityScreen';
import { RosterScreen } from './screens/RosterScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { AttendanceScreen } from './screens/AttendanceScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { OrganizeScreen } from './screens/OrganizeScreen';
import { MappingScreen } from './screens/MappingScreen';
import { MembersScreen } from './screens/MembersScreen';
import { MemberDetailScreen } from './screens/MemberDetailScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LoginScreen } from './screens/LoginScreen';
import { AccountsScreen } from './screens/AccountsScreen';

function MotionSync() {
  const { state } = useStore();
  useEffect(() => applyMotionPreference(state.settings.motion), [state.settings.motion]);
  return null;
}

function Routes() {
  const { route } = useRouter();
  const [first, second, third] = route.segments;
  switch (first) {
    case 'canyon':
      if (second === 'availability') return <AvailabilityScreen eventId={third} />;
      if (second === 'roster') return <RosterScreen eventId={third} />;
      if (second === 'review') return <ReviewScreen eventId={third} />;
      if (second === 'attendance') return <AttendanceScreen eventId={third} />;
      if (second === 'history') return <HistoryScreen eventId={third} />;
      if (second === 'schedule') return <ScheduleScreen eventId={third} />;
      return <CanyonScreen eventId={second} />;
    case 'organize':
      if (second === 'mapping') return <MappingScreen />;
      return <OrganizeScreen />;
    case 'members':
      if (second) return <MemberDetailScreen memberId={second} />;
      return <MembersScreen />;
    case 'settings':
      if (second === 'accounts') return <AccountsScreen />;
      return <SettingsScreen />;
    default:
      return <HomeScreen />;
  }
}

/** Gates the app on authentication when connected to the alliance server. */
function Gate() {
  const { mode, authState } = useStore();
  if (mode === 'api' && authState === 'signed_out') return <LoginScreen />;
  if (mode === 'api' && authState === 'loading') {
    return (
      <main className="page" aria-busy="true">
        <div style={{ textAlign: 'center', paddingTop: 48 }}>
          <img src={`${import.meta.env.BASE_URL}brand/stry-logo.png`} alt="STRY" width={96} height={96} />
          <p className="muted small">Connecting to the alliance…</p>
        </div>
        <Skeleton rows={4} height={72} />
      </main>
    );
  }
  return (
    <>
      <Routes />
      <TabBar />
    </>
  );
}

export function App() {
  return (
    <FeedbackProvider>
      <StoreProvider>
        <UiStateProvider>
          <RouterProvider>
            <MotionSync />
            <div className="app">
              <Gate />
            </div>
          </RouterProvider>
        </UiStateProvider>
      </StoreProvider>
    </FeedbackProvider>
  );
}
