import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { printInvoiceDirectly, shareInvoicePDF } from '@/services/invoicePrinter';
import { LocalInvoice } from '@/database/db';

export default function HistoryScreen() {
  const { invoices, isOnline, triggerSync } = useApp();
  const [syncing, setSyncing] = useState(false);

  const handlePrint = async (inv: LocalInvoice) => {
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
      Alert.alert('Error', e.message);
    }
  };

  const handleShare = async (inv: LocalInvoice) => {
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
      Alert.alert('Error', e.message);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Sin Conexión', 'No hay acceso a internet para sincronizar con Supabase en este momento.');
      return;
    }
    setSyncing(true);
    try {
      const res = await triggerSync();
      Alert.alert('Sincronización', `Procesadas: ${res.processed} facturas hacia la nube.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.title}>Historial de Facturas</Text>
            <Text style={styles.sub}>Almacenadas en SQLite & Nube (Supabase)</Text>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, !isOnline && styles.syncButtonOffline]}
            onPress={handleManualSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.syncButtonText}>
                  {isOnline ? 'Sincronizar' : 'Offline'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Banner de estado de conectividad */}
        <View style={[styles.networkBanner, isOnline ? styles.bannerOnline : styles.bannerOffline]}>
          <Ionicons
            name={isOnline ? 'checkmark-circle-outline' : 'warning-outline'}
            size={16}
            color={isOnline ? '#166534' : '#991b1b'}
          />
          <Text style={[styles.networkBannerText, isOnline ? styles.textOnline : styles.textOffline]}>
            {isOnline
              ? 'Conectado a producción (Supabase sincronizado)'
              : 'Modo Offline: las facturas se guardan localmente en SQLite y se subirán al detectar red'}
          </Text>
        </View>
      </View>

      {invoices.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={64} color="#94a3b8" />
          <Text style={styles.emptyText}>No tienes facturas emitidas aún</Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.invoiceNumber}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const items = JSON.parse(item.itemsJson || '[]');
            const isSynced = Boolean(item.synced);

            return (
              <View style={styles.invoiceCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.invNumber}>{item.invoiceNumber}</Text>
                    <Text style={styles.date}>
                      {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.badgesCol}>
                    <View style={styles.badgePaid}>
                      <Text style={styles.badgeText}>PAGADA</Text>
                    </View>
                    <View style={[styles.syncBadge, isSynced ? styles.syncBadgeDone : styles.syncBadgePending]}>
                      <Ionicons
                        name={isSynced ? 'cloud-done' : 'time-outline'}
                        size={10}
                        color={isSynced ? '#047857' : '#b45309'}
                      />
                      <Text style={[styles.syncBadgeText, isSynced ? styles.syncTextDone : styles.syncTextPending]}>
                        {isSynced ? 'En la Nube' : 'Pendiente Supabase'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.customer}>Cliente: {item.customerName}</Text>
                <Text style={styles.itemsSummary}>
                  {items.length} {items.length === 1 ? 'producto' : 'productos'} registrados
                </Text>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    Total (IVA {(item.taxRate * 100).toFixed(0)}% incl.):
                  </Text>
                  <Text style={styles.totalValue}>${item.total.toFixed(2)}</Text>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.printBtn]}
                    onPress={() => handlePrint(item)}
                  >
                    <Ionicons name="print-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Imprimir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.shareBtn]}
                    onPress={() => handleShare(item)}
                  >
                    <Ionicons name="share-social-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Compartir PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  sub: {
    fontSize: 12,
    color: '#64748b',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncButtonOffline: {
    backgroundColor: '#64748b',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  bannerOnline: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  bannerOffline: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  networkBannerText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  textOnline: {
    color: '#166534',
  },
  textOffline: {
    color: '#991b1b',
  },
  list: {
    padding: 16,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  date: {
    fontSize: 12,
    color: '#64748b',
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badgePaid: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: 'bold',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  syncBadgeDone: {
    backgroundColor: '#ecfdf5',
  },
  syncBadgePending: {
    backgroundColor: '#fffbeb',
  },
  syncBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  syncTextDone: {
    color: '#047857',
  },
  syncTextPending: {
    color: '#b45309',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  customer: {
    fontSize: 13,
    color: '#334155',
  },
  itemsSummary: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  totalLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  printBtn: {
    backgroundColor: '#0284c7',
  },
  shareBtn: {
    backgroundColor: '#10b981',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 12,
  },
});
