import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';

export default function AuthScreen() {
  const { user, login, register, logout } = useApp();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atención', 'Por favor ingresa correo y contraseña');
      return;
    }
    if (isRegister && !name.trim()) {
      Alert.alert('Atención', 'Por favor ingresa tu nombre');
      return;
    }

    try {
      setLoading(true);
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
        Alert.alert('Éxito', 'Cuenta registrada correctamente en el microservicio');
      } else {
        await login(email.trim(), password);
        Alert.alert('Bienvenido', 'Has iniciado sesión exitosamente');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <View style={styles.container}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#2563eb" />
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {user.role === 'admin' ? 'Rol: Administrador' : 'Rol: Usuario'} · sesión guardada en SQLite
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.formCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="cart-outline" size={40} color="#2563eb" />
          </View>
          <Text style={styles.title}>{isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</Text>
          <Text style={styles.subtitle}>Microservicio de Autenticación con SQLite local</Text>

          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre Completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Juan Pérez"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="demo@test.com"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.disabledBtn]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRegister ? 'Registrarse' : 'Ingresar'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => setIsRegister(!isRegister)}
          >
            <Text style={styles.switchModeText}>
              {isRegister
                ? '¿Ya tienes una cuenta? Inicia sesión aquí'
                : '¿No tienes cuenta? Regístrate aquí'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scroll: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledBtn: {
    backgroundColor: '#93c5fd',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchModeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#2563eb',
    fontSize: 13,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 30,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    elevation: 3,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 14,
  },
  badge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 26,
  },
  badgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  logoutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
