import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { printInvoiceDirectly, shareInvoicePDF } from '@/services/invoicePrinter';
import { useRouter } from 'expo-router';

export default function CartScreen() {
  const router = useRouter();
  const {
    cart,
    totals,
    taxRate,
    setTaxRate,
    addToCart,
    decrementQuantity,
    removeFromCart,
    checkout,
    user
  } = useApp();

  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<any>(null);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showAlert('Carrito vacío', 'Agrega productos antes de facturar');
      return;
    }
    try {
      setLoading(true);
      const generatedInvoice = await checkout('Tarjeta / Efectivo');
      setSuccessModal(generatedInvoice);
    } catch (e: any) {
      console.error('Error al facturar:', e);
      showAlert('Error al facturar', e.message || 'No se pudo procesar la orden');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (inv: any) => {
    try {
      await printInvoiceDirectly({
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        subtotal: inv.subtotal,
        taxRate: inv.taxRate,
        iva: inv.iva,
        total: inv.total,
        items: JSON.parse(inv.itemsJson),
        paymentMethod: inv.paymentMethod
      });
    } catch (e: any) {
      showAlert('Error de impresión', e.message);
    }
  };

  const handleShare = async (inv: any) => {
    try {
      await shareInvoicePDF({
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        subtotal: inv.subtotal,
        taxRate: inv.taxRate,
        iva: inv.iva,
        total: inv.total,
        items: JSON.parse(inv.itemsJson),
        paymentMethod: inv.paymentMethod
      });
    } catch (e: any) {
      showAlert('Error al compartir', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Carrito de Compras</Text>
        <Text style={styles.headerSub}>Persistido con SQLite Local & Nube Supabase</Text>
      </View>

      {/* Tax rate selector */}
      <View style={styles.taxSelectorContainer}>
        <Text style={styles.taxLabel}>Tasa de IVA aplicada:</Text>
        <View style={styles.taxPills}>
          {[0, 0.08, 0.16, 0.19].map((rate) => (
            <TouchableOpacity
              key={rate}
              style={[styles.taxPill, taxRate === rate && styles.taxPillActive]}
              onPress={() => setTaxRate(rate)}
            >
              <Text
                style={[
                  styles.taxPillText,
                  taxRate === rate && styles.taxPillTextActive
                ]}
              >
                {(rate * 100).toFixed(0)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={72} color="#94a3b8" />
          <Text style={styles.emptyText}>Tu carrito está vacío</Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.push('/')}
          >
            <Text style={styles.exploreBtnText}>Ir al Catálogo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={cart}
          keyExtractor={(item) => item.productId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.cartCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>
                  ${item.price.toFixed(2)} c/u
                </Text>
                <Text style={styles.itemTotal}>
                  Subtotal: ${(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>

              <View style={styles.qtyControls}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => decrementQuantity(item.productId)}
                >
                  <Ionicons name="remove" size={16} color="#0f172a" />
                </TouchableOpacity>

                <Text style={styles.qtyText}>{item.quantity}</Text>

                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() =>
                    addToCart({
                      id: item.productId,
                      name: item.name,
                      price: item.price
                    })
                  }
                >
                  <Ionicons name="add" size={16} color="#0f172a" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => removeFromCart(item.productId)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Footer Totals & Checkout Button */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${totals.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              IVA ({(totals.taxRate * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.summaryValue}>${totals.iva.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalValue}>${totals.total.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.checkoutBtn, loading && styles.disabledBtn]}
            onPress={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="receipt-outline" size={20} color="#fff" />
                <Text style={styles.checkoutBtnText}>Generar Factura</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Success / Invoice Modal */}
      <Modal
        visible={!!successModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={56} color="#10b981" />
            <Text style={styles.modalTitle}>¡Factura Emitida!</Text>
            <Text style={styles.modalSub}>
              Guardada en SQLite y sincronizada con Supabase
            </Text>

            {successModal && (
              <View style={styles.modalInvoiceBox}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalMetaLabel}>N° Factura:</Text>
                  <Text style={styles.modalMetaVal}>{successModal.invoiceNumber}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalMetaLabel}>Cliente:</Text>
                  <Text style={styles.modalMetaVal}>{successModal.customerName}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalMetaLabel}>Subtotal:</Text>
                  <Text style={styles.modalMetaVal}>${Number(successModal.subtotal).toFixed(2)}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalMetaLabel}>IVA ({(Number(successModal.taxRate) * 100).toFixed(0)}%):</Text>
                  <Text style={styles.modalMetaVal}>${Number(successModal.iva).toFixed(2)}</Text>
                </View>
                <View style={[styles.modalRow, styles.modalTotalRow]}>
                  <Text style={styles.modalTotalLabel}>TOTAL:</Text>
                  <Text style={styles.modalTotalVal}>${Number(successModal.total).toFixed(2)}</Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.printBtn]}
                onPress={() => handlePrint(successModal)}
              >
                <Ionicons name="print-outline" size={18} color="#fff" />
                <Text style={styles.modalBtnText}>Imprimir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.shareBtn]}
                onPress={() => handleShare(successModal)}
              >
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <Text style={styles.modalBtnText}>PDF / Compartir</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => {
                setSuccessModal(null);
                router.push('/history');
              }}
            >
              <Text style={styles.closeModalText}>Ver en Historial</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
  },
  taxSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  taxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  taxPills: {
    flexDirection: 'row',
    gap: 6,
  },
  taxPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  taxPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  taxPillText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  taxPillTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
  },
  cartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 3,
  },
  itemPrice: {
    fontSize: 12,
    color: '#64748b',
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 2,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    minWidth: 16,
    textAlign: 'center',
  },
  deleteBtn: {
    marginLeft: 6,
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    marginBottom: 20,
  },
  exploreBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exploreBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  checkoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledBtn: {
    backgroundColor: '#93c5fd',
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 10,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInvoiceBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalMetaLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  modalMetaVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  modalTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 8,
    marginTop: 6,
    marginBottom: 0,
  },
  modalTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalTotalVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 14,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  printBtn: {
    backgroundColor: '#0284c7',
  },
  shareBtn: {
    backgroundColor: '#10b981',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeModalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeModalText: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
