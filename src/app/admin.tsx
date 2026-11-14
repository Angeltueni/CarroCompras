import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import ProductsAdmin from '@/components/admin/ProductsAdmin';
import UsersAdmin from '@/components/admin/UsersAdmin';

type Section = 'products' | 'users';

export default function AdminScreen() {
  const { isAdmin } = useApp();
  const [section, setSection] = useState<Section>('products');

  // Defensa en la UI; la autorización real se valida en los microservicios con el token
  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Ionicons name="lock-closed-outline" size={56} color="#94a3b8" />
        <Text style={styles.deniedText}>Acceso restringido a administradores</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel de Administración</Text>
        <Text style={styles.sub}>Productos, stock y usuarios</Text>
      </View>

      <View style={styles.segment}>
        {([
          { key: 'products', label: 'Productos y stock', icon: 'cube-outline' },
          { key: 'users', label: 'Usuarios', icon: 'people-outline' }
        ] as const).map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.segmentBtn, section === s.key && styles.segmentBtnActive]}
            onPress={() => setSection(s.key)}
          >
            <Ionicons name={s.icon} size={16} color={section === s.key ? '#fff' : '#475569'} />
            <Text style={[styles.segmentText, section === s.key && styles.segmentTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.body}>{section === 'products' ? <ProductsAdmin /> : <UsersAdmin />}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  deniedText: { color: '#64748b', fontSize: 15 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  sub: { fontSize: 12, color: '#64748b' },
  segment: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 0 },
  segmentBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#e2e8f0' },
  segmentBtnActive: { backgroundColor: '#2563eb' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  segmentTextActive: { color: '#fff' },
  body: { flex: 1 }
});
