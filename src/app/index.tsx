import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Product } from '@/services/api';
import { notify } from '@/services/notify';
import { useRouter } from 'expo-router';

const LOW_STOCK = 5;

export default function CatalogScreen() {
  const router = useRouter();
  // products llega en TIEMPO REAL desde el contexto (Supabase Realtime)
  const { cart, addToCart, user, products, productsLoading, realtimeConnected, reloadProducts } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await reloadProducts();
    setRefreshing(false);
  };

  const handleAdd = async (item: Product) => {
    try {
      await addToCart(item);
    } catch (e: any) {
      notify('Stock insuficiente', e.message);
    }
  };

  const totalItemsCount = cart.reduce((acc, it) => acc + it.quantity, 0);

  const renderProduct = ({ item }: { item: Product }) => {
    const inCart = cart.find((c) => c.productId === item.id);
    const soldOut = item.stock <= 0;
    const lowStock = !soldOut && item.stock <= LOW_STOCK;
    const atLimit = !!inCart && inCart.quantity >= item.stock;

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.image }} style={styles.productImg} />
        <View style={styles.info}>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          <Text style={[styles.stock, soldOut && styles.stockOut, lowStock && styles.stockLow]}>
            {soldOut ? 'Agotado' : lowStock ? `¡Quedan solo ${item.stock}!` : `Stock: ${item.stock} disp.`}
          </Text>

          <TouchableOpacity
            style={[
              styles.addBtn,
              inCart ? styles.addBtnActive : null,
              (soldOut || atLimit) && styles.addBtnDisabled
            ]}
            disabled={soldOut || atLimit}
            onPress={() => handleAdd(item)}
          >
            <Ionicons
              name={soldOut ? 'close-circle-outline' : inCart ? 'checkmark-circle' : 'cart-outline'}
              size={18}
              color="#fff"
            />
            <Text style={styles.addBtnText}>
              {soldOut
                ? 'Agotado'
                : atLimit
                  ? `Máximo en carrito (${inCart?.quantity})`
                  : inCart
                    ? `En carrito (${inCart.quantity})`
                    : 'Agregar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>
            {user ? `Hola, ${user.name}` : 'Sesión: Modo Invitado'}
          </Text>
          <Text style={styles.headerTitle}>Catálogo de Productos</Text>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, realtimeConnected ? styles.liveDotOn : styles.liveDotOff]} />
            <Text style={styles.liveText}>
              {realtimeConnected ? 'Stock en vivo' : 'Stock: actualizando cada 15 s'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cartIconButton}
          onPress={() => router.push('/cart')}
        >
          <Ionicons name="cart" size={24} color="#0f172a" />
          {totalItemsCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalItemsCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {productsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Conectando con Microservicio de Productos...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          numColumns={2}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.loadingText}>No hay productos disponibles</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cartIconButton: {
    padding: 8,
    position: 'relative',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  list: {
    padding: 8,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productImg: {
    width: '100%',
    height: 120,
    backgroundColor: '#e2e8f0',
  },
  info: {
    padding: 12,
  },
  category: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#2563eb',
    fontWeight: '700',
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    height: 34,
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 2,
  },
  stock: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 10,
  },
  stockOut: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  stockLow: {
    color: '#d97706',
    fontWeight: 'bold',
  },
  addBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveDotOn: {
    backgroundColor: '#10b981',
  },
  liveDotOff: {
    backgroundColor: '#f59e0b',
  },
  liveText: {
    fontSize: 10,
    color: '#64748b',
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addBtnActive: {
    backgroundColor: '#059669',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
