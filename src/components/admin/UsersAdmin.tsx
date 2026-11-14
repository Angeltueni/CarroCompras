import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { api, ManagedUser } from '@/services/api';
import { notify, confirmDialog } from '@/services/notify';

interface FormState {
  id: string | null; // null = usuario nuevo
  name: string;
  email: string;
  password: string; // al editar, vacío = no cambiar
  role: 'admin' | 'user';
}

const emptyForm: FormState = { id: null, name: '', email: '', password: '', role: 'user' };

export default function UsersAdmin() {
  const { user } = useApp();
  const token = user?.token;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setUsers(await api.listUsers(token));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim()) return notify('Atención', 'Nombre y email son requeridos');
    if (form.id === null && !form.password) return notify('Atención', 'La contraseña es requerida');

    setBusy(true);
    try {
      if (form.id === null) {
        await api.createUser(token, {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role
        });
      } else {
        await api.updateUser(token, form.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          ...(form.password ? { password: form.password } : {})
        });
      }
      setForm(null);
      await load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: ManagedUser) => {
    const ok = await confirmDialog('Eliminar usuario', `¿Eliminar a ${u.name} (${u.email})?`, 'Eliminar');
    if (!ok) return;
    try {
      await api.deleteUser(token, u.id);
      await load();
    } catch (e: any) {
      notify('Error', e.message);
    }
  };

  const renderItem = ({ item }: { item: ManagedUser }) => {
    const isMe = item.id === user?.id;
    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name={item.role === 'admin' ? 'shield-checkmark' : 'person'} size={22} color={item.role === 'admin' ? '#7c3aed' : '#2563eb'} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
            {isMe ? ' (tú)' : ''}
          </Text>
          <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
          <View style={[styles.rolePill, item.role === 'admin' ? styles.roleAdmin : styles.roleUser]}>
            <Text style={[styles.roleText, item.role === 'admin' ? styles.roleAdminText : styles.roleUserText]}>
              {item.role === 'admin' ? 'ADMIN' : 'USUARIO'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setForm({ id: item.id, name: item.name, email: item.email, password: '', role: item.role })}
        >
          <Ionicons name="create-outline" size={20} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, isMe && styles.disabled]} disabled={isMe} onPress={() => remove(item)}>
          <Ionicons name="trash-outline" size={20} color="#dc2626" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <Text style={styles.count}>{users.length} usuarios</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setForm({ ...emptyForm })}>
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Nuevo usuario</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.primaryBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        />
      )}

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{form?.id === null ? 'Nuevo usuario' : 'Editar usuario'}</Text>

              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={form?.name} onChangeText={(v) => setForm((f) => f && { ...f, name: v })} />

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={form?.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(v) => setForm((f) => f && { ...f, email: v })} />

              <Text style={styles.label}>{form?.id === null ? 'Contraseña' : 'Nueva contraseña (vacío = no cambiar)'}</Text>
              <TextInput style={styles.input} value={form?.password} secureTextEntry onChangeText={(v) => setForm((f) => f && { ...f, password: v })} />

              <Text style={styles.label}>Rol</Text>
              <View style={styles.roleRow}>
                {(['user', 'admin'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOption, form?.role === r && styles.roleOptionActive]}
                    onPress={() => setForm((f) => f && { ...f, role: r })}
                  >
                    <Text style={[styles.roleOptionText, form?.role === r && styles.roleOptionTextActive]}>
                      {r === 'admin' ? 'Administrador' : 'Usuario'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setForm(null)} disabled={busy}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.flex, busy && styles.disabled]} onPress={save} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  count: { fontSize: 13, color: '#64748b' },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  email: { fontSize: 12, color: '#64748b', marginVertical: 2 },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleAdmin: { backgroundColor: '#ede9fe' },
  roleUser: { backgroundColor: '#dbeafe' },
  roleText: { fontSize: 10, fontWeight: 'bold' },
  roleAdminText: { color: '#5b21b6' },
  roleUserText: { color: '#1e40af' },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  disabled: { opacity: 0.4 },
  errorBox: { alignItems: 'center', gap: 12, padding: 24 },
  errorText: { color: '#b91c1c', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  roleOptionActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  roleOptionText: { color: '#475569', fontWeight: '600' },
  roleOptionTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600' }
});
