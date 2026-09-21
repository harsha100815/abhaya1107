import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { authViewSchema, messageViewSchema, registerSchema, loginSchema } from '@abhaya/validation';
import { Screen, Heading, Card, Input, Button, useAction, Feedback, Banner } from '../src/ui';
import { api, API_URL, useSession } from '../src/session';
export default function Authentication() {
  const params = useLocalSearchParams<{ mode: string }>(),
    [mode, setMode] = useState(params.mode === 'login' ? 'login' : 'register'),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const action = useAction(),
    { save } = useSession();
  return (
    <Screen>
      <Button label="Back" secondary onPress={() => router.back()} />
      <Heading
        eyebrow="WELCOME TO ABHAYA 1107"
        title={
          mode === 'register'
            ? 'Start with peace of mind.'
            : mode === 'login'
              ? 'Good to have you back.'
              : 'Let’s get you back in.'
        }
      />
      {!API_URL && (
        <Banner error>
          The API URL is not configured. Set EXPO_PUBLIC_API_URL before starting the app.
        </Banner>
      )}
      <Card>
        {mode === 'register' && (
          <Input label="Your name" value={name} onChangeText={setName} autoComplete="name" />
        )}
        <Input
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        {mode !== 'forgot' && (
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder={mode === 'register' ? 'At least 12 characters' : 'Your password'}
          />
        )}
        <Feedback action={action} />
        <Button
          label={
            mode === 'register'
              ? 'Create account'
              : mode === 'login'
                ? 'Sign in'
                : 'Send reset link'
          }
          busy={action.busy}
          disabled={!API_URL}
          onPress={() =>
            void action.run(async () => {
              if (mode === 'forgot') {
                action.setMessage(
                  (await api.call('POST', '/auth/forgot-password', messageViewSchema, { email }))
                    .message,
                );
                return;
              }
              const input =
                mode === 'register'
                  ? registerSchema.parse({ name, email, password })
                  : loginSchema.parse({ email, password });
              const session = await api.call('POST', `/auth/${mode}`, authViewSchema, input);
              await save(session);
              router.replace(mode === 'register' ? '/permissions' : '/');
            })
          }
        />
        <Button
          label={
            mode === 'register' ? 'Already registered? Sign in' : 'New here? Create an account'
          }
          secondary
          onPress={() => setMode(mode === 'register' ? 'login' : 'register')}
        />
        {mode === 'login' && (
          <Button label="Forgot password" secondary onPress={() => setMode('forgot')} />
        )}
      </Card>
    </Screen>
  );
}
