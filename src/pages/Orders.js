import React, { useState, useEffect } from 'react';
import './Orders.css';
import { FaShoppingBag, FaBoxOpen, FaClock, FaCheckCircle, FaTimesCircle, FaDownload, FaSpinner } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getImageUrl } from '../utils/imageUtils';

const Orders = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser) {
        setError('Please login to view your orders');
        setLoading(false);
        return;
      }

      try {
        const ordersRef = collection(db, 'orders');
        
        // First try with the filtered query
        let ordersData = [];
        
        try {
          const q = query(
            ordersRef,
            where('userId', '==', currentUser.uid)
          );
          
          const querySnapshot = await getDocs(q);
          
          querySnapshot.forEach((doc) => {
            ordersData.push({
              id: doc.id,
              ...doc.data()
            });
          });
        } catch (queryError) {
          console.warn('Filtered query failed, trying to fetch all orders:', queryError);
          
          // Fallback: Get all orders and filter on client side
          // This is less efficient but works if there are index issues
          const allOrdersSnapshot = await getDocs(ordersRef);
          
          allOrdersSnapshot.forEach((doc) => {
            const orderData = doc.data();
            if (orderData.userId === currentUser.uid) {
              ordersData.push({
                id: doc.id,
                ...orderData
              });
            }
          });
        }
        
        // Sort by createdAt on the client side to avoid index requirement
        ordersData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA; // Descending order (newest first)
        });
        
        setOrders(ordersData);
      } catch (err) {
        console.error('Error fetching orders:', err);
        console.error('Error details:', {
          code: err.code,
          message: err.message,
          userId: currentUser?.uid
        });
        
        // Provide more specific error messages
        if (err.code === 'permission-denied') {
          setError('Permission denied. Please check your login status.');
        } else if (err.code === 'unavailable') {
          setError('Service temporarily unavailable. Please try again.');
        } else {
          setError(`Failed to load orders: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <FaClock className="orders__status-icon orders__status-icon--pending" />;
      case 'confirmed':
        return <FaCheckCircle className="orders__status-icon orders__status-icon--confirmed" />;
      case 'cancelled':
        return <FaTimesCircle className="orders__status-icon orders__status-icon--cancelled" />;
      default:
        return <FaClock className="orders__status-icon orders__status-icon--pending" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#ffa500';
      case 'confirmed':
        return '#28a745';
      case 'cancelled':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatInvoiceDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const numberToWords = (num) => {
    if (num === null || num === undefined || isNaN(num)) return 'zero rupees';

    const belowTwenty = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

    const twoDigits = (n) => {
      if (n < 20) return belowTwenty[n];
      const tensWord = tens[Math.floor(n / 10)];
      const unit = n % 10;
      return unit ? `${tensWord}-${belowTwenty[unit]}` : tensWord;
    };

    const threeDigits = (n) => {
      const hundred = Math.floor(n / 100);
      const remainder = n % 100;
      const hundredPart = hundred ? `${belowTwenty[hundred]} hundred${remainder ? ' and ' : ''}` : '';
      const remainderPart = remainder ? twoDigits(remainder) : '';
      return `${hundredPart}${remainderPart}`;
    };

    const formatIndian = (n) => {
      const crore = Math.floor(n / 10000000);
      const lakh = Math.floor((n % 10000000) / 100000);
      const thousand = Math.floor((n % 100000) / 1000);
      const hundred = n % 1000;

      const parts = [];
      if (crore) parts.push(`${threeDigits(crore)} crore`);
      if (lakh) parts.push(`${threeDigits(lakh)} lakh`);
      if (thousand) parts.push(`${threeDigits(thousand)} thousand`);
      if (hundred) parts.push(threeDigits(hundred));

      return parts.join(' ').trim();
    };

    const integerPart = Math.floor(Math.abs(num));
    const fractionPart = Math.round((Math.abs(num) - integerPart) * 100);

    if (integerPart === 0 && fractionPart === 0) return 'zero rupees';

    const integerWords = formatIndian(integerPart) || 'zero';
    const fractionWords = fractionPart ? ` and ${twoDigits(fractionPart)} paise` : '';

    return `${integerWords} rupees${fractionWords}`.replace(/\s+/g, ' ');
  };

  const loadLogoDataUrl = async () => {
    if (logoDataUrl) return logoDataUrl;
    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/bakery-icon-logo.png`);
      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setLogoDataUrl(dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('Unable to load bakery logo for PDF:', err);
      return null;
    }
  };

  const getTotals = (order) => {
    const subtotal = Number(order.subtotal ?? 0);
    const gst = Number(order.gstAmount ?? order.tax ?? 0);
    const delivery = Number(order.deliveryPartnerCharge ?? 0);
    const handling = Number(order.handlingBagCharge ?? 0);
    const discount = Number(order.discountAmount ?? 0);
    const total = Number(order.total ?? subtotal + gst + delivery + handling - discount);

    return { subtotal, gst, delivery, handling, discount, total };
  };

  const formatCurrency = (value = 0) => `₹${Number(value ?? 0).toFixed(2)}`;

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: '#f59e0b' };
      case 'confirmed':
        return { label: 'Confirmed', color: '#10b981' };
      case 'cancelled':
        return { label: 'Cancelled', color: '#ef4444' };
      default:
        return { label: 'Pending', color: '#f59e0b' };
    }
  };

  const handleDownloadBill = async (order) => {
    setDownloadingId(order.id);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginLeft = 15;
      let currentY = 3;

      const logo = await loadLogoDataUrl();
      
      // Add logo at top center
      if (logo) {
        const logoWidth = 40;
        const logoHeight = 30;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logo, 'PNG', logoX, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 5;
      }

      // Add company name below logo (centered)
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      const companyName = 'SLV Iyengar Bakery';
      doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;

      // Add a line below company name
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      const lineMargin = 20;
      doc.line(lineMargin, currentY, pageWidth - lineMargin, currentY);
      currentY += 10;

      // Reset font
      doc.setFont(undefined, 'normal');

      // Company details on the left
      doc.setFontSize(10);
      const companyDetailsStartY = currentY;
      [
        'FSSAI Number: 2025078765676543256',
        'Email: info@slviyengar.com',
        'GSTIN: 29AARAK9899R',
        'Address: 30, 4th Main Rd, 4th T Block West,',
        'Kumar Swamy Layout, Hassan',
        'Karnataka, INDIA - 563217'
      ].forEach(line => {
        doc.text(line, marginLeft, currentY, { align: 'left' });
        currentY += 6;
      });

      // Tax Invoice section on the right (positioned after the line, aligned with company details)
      doc.setFontSize(16);
      const invoiceHeaderY = companyDetailsStartY;
      doc.text('Tax Invoice', pageWidth - marginLeft, invoiceHeaderY, { align: 'right' });
      doc.setFontSize(10);
      doc.text(`Order ID: #${order.id.slice(-8).toUpperCase()}`, pageWidth - marginLeft, invoiceHeaderY + 8, { align: 'right' });
      doc.text(`Invoice Date: ${formatInvoiceDate(order.createdAt)}`, pageWidth - marginLeft, invoiceHeaderY + 14, { align: 'right' });
      doc.text(`Order Status: ${getStatusInfo(order.status).label}`, pageWidth - marginLeft, invoiceHeaderY + 20, { align: 'right' });

      const invoiceBlockEndY = invoiceHeaderY + 26;
      currentY = Math.max(currentY, invoiceBlockEndY) + 10;

      const customerName = order.userProfile?.name || order.customerName || currentUser?.displayName || 'N/A';
      const customerEmail = order.userProfile?.email || order.customerEmail || currentUser?.email || 'N/A';
      const customerPhone = order.userProfile?.phoneNumber || order.customerPhone || 'N/A';
      const customerAddress = order.userProfile?.address
        ? `${order.userProfile.address}${order.userProfile.city ? `, ${order.userProfile.city}` : ''}${order.userProfile.state ? `, ${order.userProfile.state}` : ''}${order.userProfile.pincode ? ` - ${order.userProfile.pincode}` : ''}`
        : (order.customerAddress || 'N/A');

      autoTable(doc, {
        startY: currentY,
        head: [['Customer Information', 'Order Information']],
        body: [[
          `Invoice To: ${customerName}\nAddress: ${customerAddress}\nPhone: ${customerPhone}\nEmail: ${customerEmail}`,
          `Order ID: #${order.id.slice(-8).toUpperCase()}\nDate of Invoice: ${formatInvoiceDate(order.createdAt)}\nOrder Status: ${getStatusInfo(order.status).label}`
        ]],
        styles: { fontSize: 9, cellPadding: 4, valign: 'top' },
        headStyles: { fillColor: [102, 126, 234] },
        columnStyles: {
          0: { cellWidth: (pageWidth / 2) - marginLeft },
          1: { cellWidth: (pageWidth / 2) - marginLeft }
        }
      });

      const afterInfoY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : currentY + 10;
      const items = order.items || [];

      autoTable(doc, {
        startY: afterInfoY,
        head: [['Item', 'Weight', 'Quantity', 'Item Price', 'GST%', 'Total Amount']],
        body: (items.length ? items : [{}]).map(item => {
          const itemTotal = Number(item.price ?? 0) * Number(item.quantity ?? 0);
          const gst = Number(item.gst ?? 0);
          return [
            item.name || 'N/A',
            item.selectedWeight?.label || 'N/A',
            item.quantity || 0,
            formatCurrency(item.price ?? 0),
            formatCurrency(gst),
            formatCurrency(itemTotal)
          ];
        }),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [102, 126, 234] },
        theme: 'striped'
      });

      const totals = getTotals(order);
      const afterItemsY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : afterInfoY + 8;

      const totalsTableWidth = pageWidth - marginLeft * 2;

      autoTable(doc, {
        startY: afterItemsY,
        theme: 'plain',
        margin: { left: marginLeft, right: marginLeft },
        tableWidth: totalsTableWidth,
        body: [
          ['Subtotal', formatCurrency(totals.subtotal)],
          ['GST', formatCurrency(totals.gst)],
          ['Delivery partner charge', formatCurrency(totals.delivery)],
          ['Handling bag', formatCurrency(totals.handling)],
          ['Coupon discounts', totals.discount ? `- ${formatCurrency(totals.discount)}` : formatCurrency(0)],
          ['Total', formatCurrency(totals.total)],
          ['Final Total', formatCurrency(totals.total)]
        ].map(([label, value]) => ([
          { content: label, styles: { fontStyle: 'bold' } },
          { content: value, styles: { halign: 'right' } }
        ])),
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: totalsTableWidth * 0.55 },
          1: { cellWidth: totalsTableWidth * 0.45 }
        }
      });

      const summaryEndY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : afterItemsY + 10;
      const totalInWords = numberToWords(totals.total);
      doc.setFontSize(10);
      doc.text(`Total (in words): ${totalInWords}`, marginLeft, summaryEndY);

      const footerY = summaryEndY + 12;
      doc.text('Digital signature: SLV Iyengar', marginLeft, footerY);
      doc.text(`Order Date: ${formatInvoiceDate(order.createdAt)}`, pageWidth - marginLeft, footerY, { align: 'right' });

      doc.save(`Invoice-${order.id.slice(-8).toUpperCase()}.pdf`);
    } catch (err) {
      console.error('Failed to generate invoice PDF:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    loadLogoDataUrl();
  }, []);

  if (!currentUser) {
    return (
      <div className="orders__page">
        <div className="orders__container">
          <div className="orders__empty">
            <FaBoxOpen className="orders__empty-icon" />
            <h2>Please Login</h2>
            <p>You need to be logged in to view your orders.</p>
            <a href="/" className="orders__btn orders__btn--primary">Go to Login</a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="orders__page">
        <div className="orders__container">
          <div className="orders__header">
            <FaShoppingBag className="orders__header-icon" />
            <h1>My Orders</h1>
            <p>View and track your orders</p>
          </div>
          <div className="orders__loading">
            <div className="orders__spinner"></div>
            <p>Loading your orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders__page">
        <div className="orders__container">
          <div className="orders__header">
            <FaShoppingBag className="orders__header-icon" />
            <h1>My Orders</h1>
            <p>View and track your orders</p>
          </div>
          <div className="orders__error">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orders__page">
      <div className="orders__container">
        <div className="orders__header">
          <FaShoppingBag className="orders__header-icon" />
          <h1>My Orders</h1>
          <p>View and track your orders</p>
        </div>

        <div className="orders__content">
          {orders.length === 0 ? (
            <div className="orders__empty">
              <FaBoxOpen className="orders__empty-icon" />
              <h2>No Orders Yet</h2>
              <p>When you place an order, it will appear here.</p>
              <a href={`${process.env.PUBLIC_URL}/products`} className="orders__btn orders__btn--primary">
                Start Shopping
              </a>
            </div>
          ) : (
            <div className="orders__list">
              {orders.map((order) => (
                <div key={order.id} className="orders__card">
                  <div className="orders__card-header">
                    <div className="orders__card-info">
                      <h3>Order #{order.id.slice(-8)}</h3>
                      <p className="orders__card-date">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="orders__card-status">
                      {getStatusIcon(order.status)}
                      <span style={{ color: getStatusColor(order.status) }}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="orders__card-items">
                    <h4>Items ({order.items?.length || 0})</h4>
                    <div className="orders__items-list">
                      {order.items?.map((item, index) => (
                        <div key={index} className="orders__item">
                          <img src={getImageUrl(item.image)} alt={item.name} className="orders__item-image" />
                          <div className="orders__item-details">
                            <h5>{item.name}</h5>
                            <p className="orders__item-meta">
                              <span className="orders__item-category">{item.category}</span>
                              {item.selectedWeight?.label && (
                                <span className="orders__item-weight"> • Weight: {item.selectedWeight.label}</span>
                              )}
                            </p>
                            <p className="orders__item-quantity">Qty: {item.quantity} x ₹{item.price}</p>
                          </div>
                          <div className="orders__item-total">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="orders__card-summary">
                    <div className="orders__summary-row">
                      <span>Subtotal:</span>
                      <span>₹{order.subtotal?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="orders__summary-row">
                      <span>GST:</span>
                      <span>₹{(order.gstAmount ?? order.tax ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="orders__summary-row">
                      <span>Delivery partner charge:</span>
                      <span>₹{(order.deliveryPartnerCharge ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="orders__summary-row">
                      <span>Handling bag:</span>
                      <span>₹{(order.handlingBagCharge ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="orders__summary-row">
                      <span>Taxes & charges:</span>
                      <span>₹{(order.totalTax ?? ((order.gstAmount ?? order.tax ?? 0) + (order.deliveryPartnerCharge ?? 0) + (order.handlingBagCharge ?? 0))).toFixed(2)}</span>
                    </div>
                    {order.promoCode && order.discountAmount > 0 && (
                      <div className="orders__summary-row orders__summary-row--discount">
                        <span>Discount ({order.promoCode}):</span>
                        <span className="orders__discount-amount">-₹{order.discountAmount?.toFixed(2) || '0.00'}</span>
                      </div>
                    )}
                    <div className="orders__summary-row orders__summary-row--total">
                      <span>Total:</span>
                      <span>₹{order.total?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="orders__summary-row">
                      <span>When your order is confirmed, it will be delivered within 20 minutes.</span>
                    </div>
                  </div>

                  <div className="orders__card-actions">
                    <button 
                      className="orders__btn orders__btn--secondary"
                      onClick={() => handleDownloadBill(order)}
                      disabled={downloadingId === order.id}
                    >
                      {downloadingId === order.id ? (
                        <>
                          <FaSpinner className="orders__btn-spinner" /> Preparing PDF...
                        </>
                      ) : (
                        <>
                          <FaDownload /> Download Bill
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Orders;

