import { useEffect } from 'react';
import { FeedbackProvider, applyMotionPreference } from './motion';
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
      return <SettingsScreen />;
    default:
      return <HomeScreen />;
  }
}

export function App() {
  return (
    <FeedbackProvider>
      <StoreProvider>
        <UiStateProvider>
          <RouterProvider>
            <MotionSync />
            <div className="app">
              <Routes />
              <TabBar />
            </div>
          </RouterProvider>
        </UiStateProvider>
      </StoreProvider>
    </FeedbackProvider>
  );
}
