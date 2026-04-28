import { Tabs } from 'expo-router';
import { NexusColors } from '../../constants/theme';
import { NexusTabBar } from '../../components/nexus/NexusTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <NexusTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: NexusColors.bgPrimary },
      }}
    >
      <Tabs.Screen name="index"      options={{ title: 'Home' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Radar' }} />
      <Tabs.Screen name="analytics"  options={{ title: 'Analytics' }} />
      <Tabs.Screen name="profile"    options={{ title: 'Profile' }} />

      {/* href: null removes these from routing entirely — NexusTabBar also filters them */}
      <Tabs.Screen name="units"        options={{ href: null }} />
      <Tabs.Screen name="achievements" options={{ href: null }} />
    </Tabs>
  );
}
