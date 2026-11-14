import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { api, Product } from '@/services/api';
import { notify, confirmDialog } from '@/services/notify';

const LOW_STOCK = 5;
const QUICK_AMOUNTS = [1, 5, 10, 50];

interface FormState {
  id: string | null; // null = producto nuevo
  name: string;
  price: string;
  category: string;
  image: string;
  stock: string; // solo al crear
}

const emptyForm: FormState = { id: null, name: '', price: '', category: '', image: '', stock: '0' };

export default function ProductsAdmin() {
  const { products, productsLoading, realtimeConnected, reloadProducts, user } = useApp();
  const token = user?.token;

  const [form, setForm] = useState<FormState | null>(null);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockAmount, setStockAmount] = useState('');
  const [busy, setBusy] = useState(false);

  // Los cambios llegan solos por Realtime; reloadProducts es solo respaldo si el canal en vivo no está activo
  const afterChange = () => {
    if (!realtimeConnected) reloadProducts();
  };

  const openEdit = (p: Product) =>
    setForm({
      id: p.id,
      name: p.name,
      price: String(p.price),
      category: p.category,
      image: p.image || '',
      stock: String(p.stock)
    });

  const saveProduct = async () => {
    if (!form) return;
    const price = Number(form.price.replace(',', '.'));
    if (!form.name.trim()) return notify('Atención', 'El nombre es requerido');
    if (!Number.isFinite(price) || price < 0) return notify('Atención', 'El precio no es válido');

    setBusy(true);
    try {
      if (form.id === null) {
        const stock = Number(form.stock);
        if (!Number.isInteger(stock) || stock < 0) {
          notify('Atención', 'El stock inicial debe ser un entero mayor o igual a 0');
          return;
        }
        await api.createProduct(token, {
          name: form.name.trim(),
          price,
          category: form.category.trim() || 'General',
          stock,
          image: form.image.trim() || undefined
        });
      } else {
        await api.updateProduct(token, form.id, {
          name: form.name.trim(),
          price,
          category: form.category.trim() || 'General',
          image: form.image.trim() || undefined
        });
      }
      setForm(null);
      afterChange();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const applyStock = async (p: Product, amount: number) => {
    setBusy(true);
    try {
      await api.adjustStock(token, p.id, amount);
      setStockTarget(null);
      setStockAmount('');
      afterChange();
    } catch (e: any) {
      notify('No se pudo ajustar el stock', e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (p: Product) => {
    const ok = await confirmDialog('Eliminar producto', `¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`, 'Eliminar');
    if (!ok) return;
    try {
      await api.deleteProduct(token, p.id);
      afterChange();
    } catch (e: any) {
      notify('Error', e.message);
    }
  };

  const renderItem = ({ item }: { item: Product }) => {
    const soldOut = item.stock <= 0;
    const low = !soldOut && item.stock <= LOW_STOCK;
    return (
      <View style={styles.card}>
        <Image source={{ uri: item.image }} style={styles.thumb} />
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.meta}>{item.category} · ${item.price.toFixed(2)}</Text>
          <View style={[styles.stockPill, soldOut ? styles.stockOut : low ? styles.stockLow : styles.stockOk]}>
            <Text style={[styles.stockText, soldOut ? styles.stockOutText : low ? styles.stockLowText : styles.stockOkText]}>
              {soldOut ? 'Agotado' : `Stock: ${item.stock}`}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.iconBtn, styles.addStockBtn]} onPress={() => { setStockTarget(item); setStockAmount(''); }}>
            <Ionicons name="add-circle-outline" size={20} color="#047857" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
            <Ionicons name="create-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => removeProduct(item)}>
            <Ionicons name="trash-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const stockNumber = Number(stockAmount);
  const stockValid = Number.isInteger(stockNumber) && stockNumber !== 0;

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, { backgroundColor: realtimeConnected ? '#10b981' : '#f59e0b' }]} />
          <Text style={styles.liveText}>{realtimeConnected ? 'Cambios en vivo' : 'Sin canal en vivo'}</Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setForm({ ...emptyForm })}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Nuevo producto</Text>
        </TouchableOpacity>
      </View>

      {productsLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aún no hay productos. Crea el primero.</Text>}
        />
      )}

      {/* Crear / editar producto */}
      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{form?.id === null ? 'Nuevo producto' : 'Editar producto'}</Text>

              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={form?.name} onChangeText={(v) => setForm((f) => f && { ...f, name: v })} placeholder="Ej: Teclado mecánico" />

              <Text style={styles.label}>Precio</Text>
              <TextInput style={styles.input} value={form?.price} keyboardType="decimal-pad" onChangeText={(v) => setForm((f) => f && { ...f, price: v })} placeholder="0.00" />

              <Text style={styles.label}>Categoría</Text>
              <TextInput style={styles.input} value={form?.category} onChangeText={(v) => setForm((f) => f && { ...f, category: v })} placeholder="Tecnología" />

              <Text style={styles.label}>URL de imagen (opcional)</Text>
              <TextInput style={styles.input} value={form?.image} autoCapitalize="none" onChangeText={(v) => setForm((f) => f && { ...f, image: v })} placeholder="https://..." />

              {form?.id === null ? (
                <>
                  <Text style={styles.label}>Stock inicial</Text>
                  <TextInput style={styles.input} value={form.stock} keyboardType="number-pad" onChangeText={(v) => setForm((f) => f && { ...f, stock: v })} />
                </>
              ) : (
                <Text style={styles.hint}>Para cambiar el stock usa el botón verde (+) de la lista.</Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setForm(null)} disabled={busy}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.flex, busy && styles.disabled]} onPress={saveProduct} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ajustar stock */}
      <Modal visible={!!stockTarget} transparent animationType="fade" onRequestClose={() => setStockTarget(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.modalCentered]}>
            <Text style={styles.modalTitle}>Aumentar stock</Text>
            <Text style={styles.hint}>
              {stockTarget?.name} · actual: {products.find((p) => p.id === stockTarget?.id)?.stock ?? stockTarget?.stock}
            </Text>

            <View style={styles.chips}>
              {QUICK_AMOUNTS.map((n) => (
                <TouchableOpacity key={n} style={styles.chip} disabled={busy} onPress={() => stockTarget && applyStock(stockTarget, n)}>
                  <Text style={styles.chipText}>+{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Otra cantidad (negativa para reducir)</Text>
            <TextInput style={styles.input} value={stockAmount} keyboardType="numbers-and-punctuation" onChangeText={setStockAmount} placeholder="Ej: 25" />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStockTarget(null)} disabled={busy}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.flex, (!stockValid || busy) && styles.disabled]}
                disabled={!stockValid || busy}
                onPress={() => stockTarget && applyStock(stockTarget, stockNumber)}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Aplicar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 12, color: '#64748b' },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#e2e8f0' },
  cardBody: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', marginVertical: 2 },
  stockPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  stockOk: { backgroundColor: '#dcfce7' },
  stockLow: { backgroundColor: '#fef3c7' },
  stockOut: { backgroundColor: '#fee2e2' },
  stockText: { fontSize: 11, fontWeight: 'bold' },
  stockOkText: { color: '#166534' },
  stockLowText: { color: '#92400e' },
  stockOutText: { color: '#991b1b' },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  addStockBtn: { backgroundColor: '#d1fae5' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  disabled: { opacity: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, alignSelf: 'center' },
  modalCentered: { marginTop: 'auto', marginBottom: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 10 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#d1fae5' },
  chipText: { color: '#047857', fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600' }
});
