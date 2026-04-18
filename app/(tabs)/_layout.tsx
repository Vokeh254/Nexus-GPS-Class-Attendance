import { Tabs } from 'expo-router';
import { NexusTabBar } from '../../components/nexus/NexusTabBar';
import { NexusColors } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <NexusTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: NexusColors.bgPrimary },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="attendance" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
