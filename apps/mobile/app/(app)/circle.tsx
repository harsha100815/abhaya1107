import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import type { Contact } from '@abhaya/types';
import { contactSchema, contactViewSchema, messageViewSchema } from '@abhaya/validation';
import { api } from '../../src/session';
import {
  Screen,
  Heading,
  Card,
  Txt,
  Row,
  Input,
  Button,
  Check,
  Banner,
  Loading,
  useDashboard,
  useAction,
  Feedback,
} from '../../src/ui';
export default function Circle() {
  const query = useDashboard(),
    action = useAction(),
    [open, setOpen] = useState(false),
    [id, setId] = useState<string | null>(null),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [email, setEmail] = useState(''),
    [primary, setPrimary] = useState(false),
    [alerts, setAlerts] = useState(true),
    [consent, setConsent] = useState(false);
  const edit = (contact?: Contact) => {
    setId(contact?.id ?? null);
    setName(contact?.name ?? '');
    setPhone(contact?.phone ?? '');
    setEmail(contact?.email ?? '');
    setPrimary(contact?.isPrimary ?? false);
    setAlerts(contact?.receivesAlerts ?? true);
    setConsent(false);
    setOpen(true);
  };
  if (!query.data)
    return query.error ? (
      <Screen>
        <Banner error>{query.error.message}</Banner>
        <Button label="Retry" onPress={() => void query.refetch()} />
      </Screen>
    ) : (
      <Loading />
    );
  return (
    <Screen>
      <Heading
        eyebrow="YOUR INNER CIRCLE"
        title="Good people. Close by."
        description="Ask your contacts before adding them to receive alerts."
      />
      <Button label="Add trusted contact" onPress={() => edit()} />
      <Feedback action={action} />
      {open && (
        <Card>
          <Txt kind="title">{id ? 'Edit contact' : 'Add someone you trust'}</Txt>
          <Input label="Name" value={name} onChangeText={setName} />
          <Input
            label="Phone · international format"
            placeholder="+919876543210"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Input
            label="Email · optional"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Check label="Primary contact" value={primary} onChange={setPrimary} />
          <Check label="Receive my safety alerts" value={alerts} onChange={setAlerts} />
          <Check
            label="This person agreed to receive my safety alerts"
            value={consent}
            onChange={setConsent}
          />
          <Button
            label="Save contact"
            busy={action.busy}
            onPress={() =>
              void action.run(async () => {
                const data = contactSchema.parse({
                  name,
                  phone,
                  ...(email ? { email } : {}),
                  isPrimary: primary,
                  receivesAlerts: alerts,
                  consentConfirmed: consent,
                });
                await api.call(
                  id ? 'PATCH' : 'POST',
                  id ? `/contacts/${id}` : '/contacts',
                  contactViewSchema,
                  data,
                );
                setOpen(false);
              })
            }
          />
          <Button label="Cancel editing" secondary onPress={() => setOpen(false)} />
        </Card>
      )}
      {query.data.contacts.map((c) => (
        <Card key={c.id}>
          <Row>
            <Txt kind="title">{c.name}</Txt>
            <Txt kind="small">{c.isPrimary ? 'Primary' : ''}</Txt>
          </Row>
          <Txt>{c.phone}</Txt>
          {c.email && <Txt kind="small">{c.email}</Txt>}
          <Txt kind="small">{c.receivesAlerts ? 'Alerts enabled' : 'Alerts paused'}</Txt>
          <Button
            label={`Call ${c.name}`}
            secondary
            onPress={() => void Linking.openURL(`tel:${c.phone}`)}
          />
          <Button label={`Edit ${c.name}`} secondary onPress={() => edit(c)} />
          <Button
            label="Remove contact"
            secondary
            onPress={() =>
              Alert.alert('Remove contact?', `Remove ${c.name} from your emergency contacts?`, [
                { text: 'Keep contact', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    void action.run(async () => {
                      await api.call('DELETE', `/contacts/${c.id}`, messageViewSchema);
                    }),
                },
              ])
            }
          />
        </Card>
      ))}
      {!query.data.contacts.length && !open && (
        <Card>
          <Txt kind="title">Your circle starts with one person.</Txt>
          <Txt kind="small">Add a friend or family member who agrees to receive your alerts.</Txt>
        </Card>
      )}
    </Screen>
  );
}
