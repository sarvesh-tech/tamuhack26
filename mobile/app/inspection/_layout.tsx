import { Stack } from 'expo-router'

export default function InspectionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#141414' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="guided" />
      <Stack.Screen name="step" />
    </Stack>
  )
}
