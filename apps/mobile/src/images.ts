import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';
export async function chooseImage(camera = false) {
  const consent = await new Promise<boolean>((resolve) =>
    Alert.alert(
      'Private image upload',
      'Images can contain sensitive information. The selected image will be uploaded to your private account, encrypted at rest, and have embedded metadata removed.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: camera ? 'Take photo' : 'Choose image', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (!consent) return null;
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error('Image permission was denied. You can continue without a photo.');
  const result = camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1600) context.resize({ width: 1600 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.8,
    base64: true,
  });
  if (!image.base64) throw new Error('Image could not be prepared.');
  if (image.base64.length > 4200000) throw new Error('Choose a smaller image.');
  return { mimeType: 'image/jpeg' as const, base64: image.base64, privacyConsent: true as const };
}
