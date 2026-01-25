import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#141414' } }}>
      <Stack.Screen name="callback" />
    </Stack>
  )
}
