import { Alert, Platform } from 'react-native';

// Alert.alert no funciona en web, por eso se usa window.alert / window.confirm allí.
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmDialog(title: string, message: string, confirmText = 'Sí'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'No', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: 'destructive', onPress: () => resolve(true) }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
