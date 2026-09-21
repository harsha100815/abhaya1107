import { router } from 'expo-router';
import { Screen, Heading, Card, Txt, Button, useAction, Feedback, Banner } from '../src/ui';
import { useLiveLocation, enableBackground } from '../src/location';
import { registerPush } from '../src/notifications';
export default function Permissions() {
  const location = useLiveLocation(),
    action = useAction();
  return (
    <Screen>
      <Heading
        eyebrow="ON YOUR TERMS"
        title="Choose how we can help."
        description="These permissions are optional. You can change your mind in Settings."
      />
      <Card>
        <Txt kind="title">Location, when it matters.</Txt>
        <Txt kind="small">
          ABHAYA uses your device location for active SOS and journeys when you choose to share.
          Refreshing location alone does not send it to the server.
        </Txt>
        <Button
          label="Allow location"
          busy={location.busy}
          onPress={() => void location.refresh()}
        />
        {location.current && (
          <Banner>Location obtained · ±{Math.round(location.current.accuracy)} m</Banner>
        )}
        {location.error && <Banner error>{location.error}</Banner>}
        <Txt kind="small">
          Background access keeps sharing active when you switch apps. A terminated app may stop
          tracking.
        </Txt>
        <Button
          label="Set up background sharing"
          secondary
          onPress={() =>
            void action.run(async () => {
              if (await enableBackground())
                action.setMessage('Background sharing enabled for active sessions.');
            })
          }
        />
      </Card>
      <Card>
        <Txt kind="title">A heads-up from your circle.</Txt>
        <Txt kind="small">
          Allow notifications to receive trusted-contact and account alerts. Push delivery needs a
          configured build and a physical device.
        </Txt>
        <Button
          label="Enable notifications"
          secondary
          onPress={() =>
            void action.run(async () => {
              await registerPush();
              action.setMessage('This device is registered for push notifications.');
            })
          }
        />
      </Card>
      <Feedback action={action} />
      <Button label="Continue to my circle" onPress={() => router.replace('/circle')} />
      <Button label="Skip for now" secondary onPress={() => router.replace('/')} />
    </Screen>
  );
}
