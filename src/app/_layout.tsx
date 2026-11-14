import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import AuthScreen from './auth';

SplashScreen.preventAutoHideAsync();

function MainNavigation() {
  const { user, authLoading, cart, isAdmin } = useApp();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Si está cargando la sesión desde SQLite
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Verificando sesión local en SQLite...</Text>
      </View>
    );
  }

  // Si el usuario NO ha iniciado sesión, mostrar la pantalla de Login directamente
  if (!user) {
    return <AuthScreen />;
  }

  // Si el usuario ya está autenticado, mostrar la app principal con sus tabs
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tienda',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Carrito',
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: 24, height: 24, margin: 5 }}>
              <Ionicons name="cart-outline" size={size} color={String(color)} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Facturas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          // href: null oculta la pestaña a los usuarios normales
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="auth"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppProvider>
        <MainNavigation />
      </AppProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
