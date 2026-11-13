import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  subtotal: number;
  taxRate: number;
  iva: number;
  total: number;
  items: Array<{ name: string; price: number; quantity: number }>;
  paymentMethod: string;
}

export function buildInvoiceHtml(data: InvoiceData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px;">$${Number(item.price).toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-weight: bold;">
        $${(Number(item.price) * Number(item.quantity)).toFixed(2)}
      </td>
    </tr>
  `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Factura ${data.invoiceNumber}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          margin: 0;
          padding: 30px;
          color: #1e293b;
          background-color: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 15px;
          margin-bottom: 25px;
        }
        .company-title {
          font-size: 24px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0;
        }
        .invoice-title {
          font-size: 20px;
          font-weight: 700;
          color: #3b82f6;
          text-align: right;
          margin: 0;
        }
        .meta-text {
          font-size: 12px;
          color: #64748b;
          margin: 3px 0;
        }
        .section-box {
          background-color: #f8fafc;
          border-radius: 8px;
          padding: 12px 18px;
          margin-bottom: 25px;
        }
        .section-box h4 {
          margin: 0 0 8px 0;
          color: #334155;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #f1f5f9;
          color: #475569;
          padding: 10px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .totals-box {
          margin-left: auto;
          width: 280px;
          padding-top: 10px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 14px;
          color: #475569;
        }
        .totals-row.grand-total {
          border-top: 2px solid #0f172a;
          margin-top: 8px;
          padding-top: 10px;
          font-size: 18px;
          font-weight: bold;
          color: #0f172a;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="company-title">🛒 TIENDA EXPRESS</h1>
          <p class="meta-text">Sistema Integrado de Carrito con Microservicios</p>
          <p class="meta-text">RFC/NIT: 900.123.456-7</p>
        </div>
        <div>
          <h2 class="invoice-title">FACTURA DE VENTA</h2>
          <p class="meta-text"><b>N°:</b> ${data.invoiceNumber}</p>
          <p class="meta-text"><b>Fecha:</b> ${new Date(data.date).toLocaleString()}</p>
          <p class="meta-text"><b>Método:</b> ${data.paymentMethod}</p>
        </div>
      </div>

      <div class="section-box">
        <h4>DATOS DEL CLIENTE</h4>
        <p class="meta-text"><b>Nombre / Razón:</b> ${data.customerName}</p>
        <p class="meta-text"><b>Correo Electrónico:</b> ${data.customerEmail}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Descripción</th>
            <th style="text-align: center; width: 60px;">Cant.</th>
            <th style="text-align: right; width: 90px;">Precio Unit.</th>
            <th style="text-align: right; width: 90px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>IVA (${(data.taxRate * 100).toFixed(0)}%):</span>
          <span>$${data.iva.toFixed(2)}</span>
        </div>
        <div class="totals-row grand-total">
          <span>TOTAL:</span>
          <span>$${data.total.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p>¡Gracias por su compra! Factura respaldada en SQLite local y validada por el Microservicio de Facturación.</p>
      </div>
    </body>
  </html>
  `;
}

export async function printInvoiceDirectly(data: InvoiceData) {
  const html = buildInvoiceHtml(data);

  if (Platform.OS === 'web') {
    // En Web, abrir una ventana con el HTML de la factura y lanzar el diálogo nativo de impresión / guardar como PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
      return;
    }
  }

  // En Android / iOS
  await Print.printAsync({ html });
}

export async function shareInvoicePDF(data: InvoiceData) {
  const html = buildInvoiceHtml(data);

  if (Platform.OS === 'web') {
    // En navegador web, el diálogo de impresión permite "Guardar como PDF" nativamente
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
      return;
    }
  }

  // En Android / iOS: Generar el archivo PDF local y abrir el selector de compartir
  try {
    const file = await Print.printToFileAsync({ html });
    if (file?.uri) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Factura ${data.invoiceNumber}`,
          UTI: 'com.adobe.pdf'
        });
        return;
      }
    }
  } catch (e) {
    console.warn('Error en printToFileAsync, intentando impresión directa:', e);
  }

  // Fallback si sharing no estuviese disponible
  await Print.printAsync({ html });
}
