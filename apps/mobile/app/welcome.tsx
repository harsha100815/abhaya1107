import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Txt, Button, usePalette } from '../src/ui';
export default function Welcome() {
  const c = usePalette();
  return (
    <Screen>
      <View style={{ paddingTop: 24, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="shield-checkmark-outline" size={32} color={c.accent} />
        <Txt kind="title">abhaya 1107</Txt>
      </View>
      <View style={{ alignItems: 'center', paddingVertical: 48 }}>
        <View
          style={{
            width: 250,
            height: 250,
            borderRadius: 125,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 182,
              height: 182,
              borderRadius: 91,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.elevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={86} color={c.accent} />
          </View>
        </View>
      </View>
      <Txt kind="eyebrow">YOUR PEOPLE. WITHIN REACH.</Txt>
      <Txt kind="display">Your world.{'\n'}A little safer.</Txt>
      <Txt>
        For the late ride home. The unfamiliar route. And the people who want to know you made it.
      </Txt>
      <View style={{ gap: 12, marginTop: 20 }}>
        <Button
          label="Create my safety circle"
          onPress={() => router.push({ pathname: '/auth', params: { mode: 'register' } })}
        />
        <Button
          label="I already have an account"
          secondary
          onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })}
        />
      </View>
      <Txt kind="small">
        Private by design. Your location is shared only when you choose. ABHAYA does not
        automatically contact emergency services.
      </Txt>
    </Screen>
  );
}
