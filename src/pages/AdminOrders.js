import React, { useState, useEffect } from 'react';
import { FaShoppingBag, FaClock, FaCheckCircle, FaTimesCircle, FaSearch, FaSpinner, FaFilter, FaEye, FaDownload } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase/config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getImageUrl } from '../utils/imageUtils';
import './AdminOrders.css';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  const orderStatuses = [
    { value: 'pending', label: 'Pending', color: '#f59e0b', icon: FaClock },
    { value: 'confirmed', label: 'Confirmed', color: '#10b981', icon: FaCheckCircle },
    { value: 'cancelled', label: 'Cancelled', color: '#ef4444', icon: FaTimesCircle }
  ];

  const formatCurrency = (value = 0) => `₹${Number(value ?? 0).toFixed(2)}`;

  const toDate = (timestamp) => {
    if (!timestamp) return null;
    return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  };

  const formatInvoiceDate = (timestamp) => {
    const date = toDate(timestamp);
    if (!date) return 'N/A';
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

  // Fetch all orders from Firebase
  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    
    try {
      const ordersRef = collection(db, 'orders');
      let ordersData = [];
      
      try {
        const querySnapshot = await getDocs(ordersRef);
        
        querySnapshot.forEach((docSnapshot) => {
          ordersData.push({
            id: docSnapshot.id,
            ...docSnapshot.data()
          });
        });
      } catch (queryError) {
        console.warn('Initial query failed:', queryError);
        console.warn('Error code:', queryError.code);
        console.warn('Error message:', queryError.message);
        
        // If permission denied, show specific error
        if (queryError.code === 'permission-denied') {
          setError('Permission denied. Please make sure you are logged in as admin.');
          setLoading(false);
          return;
        }
        
        throw queryError;
      }

      // Sort by createdAt (newest first)
      ordersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      setOrders(ordersData);
      setError('');
    } catch (err) {
      console.error('Error fetching orders:', err);
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        name: err.name
      });
      
      // Provide more specific error messages
      if (err.code === 'permission-denied') {
        setError('Permission denied. Please check Firebase security rules.');
      } else if (err.code === 'unavailable') {
        setError('Service temporarily unavailable. Please try again.');
      } else if (err.code === 'unauthenticated') {
        setError('You need to be logged in to view orders.');
      } else {
        setError(`Failed to load orders: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    loadLogoDataUrl();
  }, []);

  // Update order status
  const handleStatusChange = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date()
      });

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch (err) {
      console.error('Error updating order status:', err);
      setError('Failed to update order status. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status info
  const getStatusInfo = (status) => {
    return orderStatuses.find(s => s.value === status) || orderStatuses[0];
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = !searchLower || 
      order.id.toLowerCase().includes(searchLower) ||
      order.userProfile?.name?.toLowerCase().includes(searchLower) ||
      order.userProfile?.email?.toLowerCase().includes(searchLower) ||
      order.userProfile?.phoneNumber?.includes(searchQuery) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      order.customerEmail?.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  };

  // View order details
  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const handleDownloadBill = async (order) => {
    setDownloadingId(order.id);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginLeft = 15;
      let currentY = 2;

      const logo = await loadLogoDataUrl();
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

      const customerName = order.userProfile?.name || order.customerName || 'N/A';
      const customerEmail = order.userProfile?.email || order.customerEmail || 'N/A';
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

  return (
    <div className="admin-orders">
      <div className="admin-orders__container">
        <div className="admin-orders__header">
          <div className="admin-orders__header-icon">
            <FaShoppingBag />
          </div>
          <h1>Order Management</h1>
          <p>View and manage customer orders - Update order statuses</p>
        </div>

        {/* Stats Cards */}
        <div className="admin-orders__stats">
          <div className="admin-orders__stat-card admin-orders__stat-card--total">
            <div className="admin-orders__stat-icon"><FaShoppingBag /></div>
            <div className="admin-orders__stat-info">
              <span className="admin-orders__stat-value">{stats.total}</span>
              <span className="admin-orders__stat-label">Total Orders</span>
            </div>
          </div>
          <div className="admin-orders__stat-card admin-orders__stat-card--pending">
            <div className="admin-orders__stat-icon"><FaClock /></div>
            <div className="admin-orders__stat-info">
              <span className="admin-orders__stat-value">{stats.pending}</span>
              <span className="admin-orders__stat-label">Pending</span>
            </div>
          </div>
          <div className="admin-orders__stat-card admin-orders__stat-card--confirmed">
            <div className="admin-orders__stat-icon"><FaCheckCircle /></div>
            <div className="admin-orders__stat-info">
              <span className="admin-orders__stat-value">{stats.confirmed}</span>
              <span className="admin-orders__stat-label">Confirmed</span>
            </div>
          </div>
          <div className="admin-orders__stat-card admin-orders__stat-card--cancelled">
            <div className="admin-orders__stat-icon"><FaTimesCircle /></div>
            <div className="admin-orders__stat-info">
              <span className="admin-orders__stat-value">{stats.cancelled}</span>
              <span className="admin-orders__stat-label">Cancelled</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="admin-orders__toolbar">
          <div className="admin-orders__search">
            <FaSearch className="admin-orders__search-icon" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, Email or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="admin-orders__filter">
            <FaFilter className="admin-orders__filter-icon" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              {orderStatuses.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="admin-orders__error">
            <span>{error}</span>
            <button className="admin-orders__retry-btn" onClick={fetchOrders}>
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="admin-orders__loading">
            <FaSpinner className="admin-orders__spinner" />
            <p>Loading orders...</p>
          </div>
        ) : (
          <div className="admin-orders__list">
            {filteredOrders.length === 0 ? (
              <div className="admin-orders__empty">
                <FaShoppingBag className="admin-orders__empty-icon" />
                <h3>No Orders Found</h3>
                <p>{searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'No orders have been placed yet'}</p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const statusInfo = getStatusInfo(order.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div key={order.id} className="admin-orders__card">
                    <div className="admin-orders__card-header">
                      <div className="admin-orders__order-id">
                        <span className="admin-orders__order-id-label">Order ID:</span>
                        <span className="admin-orders__order-id-value">#{order.id.slice(-8).toUpperCase()}</span>
                      </div>
                      <div className="admin-orders__order-date">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>

                    <div className="admin-orders__card-body">
                      <div className="admin-orders__order-info">
                        <div className="admin-orders__customer">
                          <h4>Customer Details</h4>
                          <p><strong>Name:</strong> {order.userProfile?.name || order.customerName || 'N/A'}</p>
                          <p><strong>Email:</strong> {order.userProfile?.email || order.customerEmail || 'N/A'}</p>
                          <p><strong>Phone:</strong> {order.userProfile?.phoneNumber || order.customerPhone || 'N/A'}</p>
                          {(order.userProfile?.address || order.customerAddress) && (
                            <p><strong>Address:</strong> {order.userProfile?.address || order.customerAddress}{order.userProfile?.city ? `, ${order.userProfile.city}` : ''}</p>
                          )}
                        </div>

                        <div className="admin-orders__items-preview">
                          <h4>Items ({order.items?.length || 0})</h4>
                          <div className="admin-orders__items-thumbnails">
                            {order.items?.slice(0, 4).map((item, index) => (
                              <div key={index} className="admin-orders__item-thumb">
                                <img 
                                  src={getImageUrl(item.image)} 
                                  alt={item.name}
                                  onError={(e) => {
                                    e.target.src = `${process.env.PUBLIC_URL}/bakery-icon-logo.png`;
                                  }}
                                />
                                {index === 3 && order.items.length > 4 && (
                                  <span className="admin-orders__more-items">+{order.items.length - 4}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="admin-orders__order-total">
                          <h4>Order Total</h4>
                          <span className="admin-orders__total-amount">₹{order.total?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>

                      <div className="admin-orders__actions">
                        <div className="admin-orders__current-status">
                          <span className="admin-orders__status-label">Current Status:</span>
                          <span 
                            className="admin-orders__status-badge"
                            style={{ backgroundColor: statusInfo.color }}
                          >
                            <StatusIcon />
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className="admin-orders__status-modifier">
                          <label>Change Status:</label>
                          <div className="admin-orders__status-buttons">
                            {orderStatuses.map(status => (
                              <button
                                key={status.value}
                                className={`admin-orders__status-btn ${order.status === status.value ? 'admin-orders__status-btn--active' : ''}`}
                                style={{ 
                                  '--status-color': status.color,
                                  backgroundColor: order.status === status.value ? status.color : 'transparent',
                                  borderColor: status.color,
                                  color: order.status === status.value ? 'white' : status.color
                                }}
                                onClick={() => handleStatusChange(order.id, status.value)}
                                disabled={updating === order.id || order.status === status.value}
                              >
                                {updating === order.id ? (
                                  <FaSpinner className="admin-orders__btn-spinner" />
                                ) : (
                                  <>
                                    <status.icon />
                                    {status.label}
                                  </>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="admin-orders__action-buttons">
                          <button 
                            className="admin-orders__view-btn"
                            onClick={() => handleViewDetails(order)}
                          >
                            <FaEye /> View Details
                          </button>
                          <button
                            className="admin-orders__download-btn"
                            onClick={() => handleDownloadBill(order)}
                            disabled={downloadingId === order.id}
                          >
                            {downloadingId === order.id ? (
                              <FaSpinner className="admin-orders__btn-spinner" />
                            ) : (
                              <FaDownload />
                            )}
                            {downloadingId === order.id ? 'Preparing PDF...' : 'Download Bill PDF'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Order Details Modal */}
        {showDetailsModal && selectedOrder && (
          <div className="admin-orders__modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="admin-orders__modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-orders__modal-header">
                <h2>Order Details</h2>
                <span className="admin-orders__modal-order-id">#{selectedOrder.id.slice(-8).toUpperCase()}</span>
                <button 
                  className="admin-orders__modal-close"
                  onClick={() => setShowDetailsModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="admin-orders__modal-body">
                <div className="admin-orders__modal-section">
                  <h3>Customer Information</h3>
                  <div className="admin-orders__modal-info-grid">
                    <div><strong>Name:</strong> {selectedOrder.userProfile?.name || selectedOrder.customerName || 'N/A'}</div>
                    <div><strong>Email:</strong> {selectedOrder.userProfile?.email || selectedOrder.customerEmail || 'N/A'}</div>
                    <div><strong>Phone:</strong> {selectedOrder.userProfile?.phoneNumber || selectedOrder.customerPhone || 'N/A'}</div>
                    <div><strong>Address:</strong> {
                      selectedOrder.userProfile?.address 
                        ? `${selectedOrder.userProfile.address}${selectedOrder.userProfile.city ? `, ${selectedOrder.userProfile.city}` : ''}${selectedOrder.userProfile.state ? `, ${selectedOrder.userProfile.state}` : ''}${selectedOrder.userProfile.pincode ? ` - ${selectedOrder.userProfile.pincode}` : ''}`
                        : (selectedOrder.customerAddress || 'N/A')
                    }</div>
                  </div>
                </div>

                <div className="admin-orders__modal-section">
                  <h3>Order Items</h3>
                  <div className="admin-orders__modal-items">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="admin-orders__modal-item">
                        <img 
                          src={getImageUrl(item.image)} 
                          alt={item.name}
                          onError={(e) => {
                            e.target.src = `${process.env.PUBLIC_URL}/bakery-icon-logo.png`;
                          }}
                        />
                        <div className="admin-orders__modal-item-info">
                          <h4>{item.name}</h4>
                          <p className="admin-orders__modal-item-meta">
                            <span className="admin-orders__modal-item-category">{item.category}</span>
                            {item.selectedWeight?.label && (
                              <span className="admin-orders__modal-item-weight"> • Weight: {item.selectedWeight.label}</span>
                            )}
                          </p>
                          <p className="admin-orders__modal-item-quantity">Qty: {item.quantity} × ₹{item.price}</p>
                        </div>
                        <div className="admin-orders__modal-item-total">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-orders__modal-section admin-orders__modal-summary">
                  <h3>Order Summary</h3>
                  <div className="admin-orders__modal-summary-row">
                    <span>Subtotal:</span>
                    <span>₹{selectedOrder.subtotal?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="admin-orders__modal-summary-row">
                    <span>GST:</span>
                    <span>₹{(selectedOrder.gstAmount ?? selectedOrder.tax ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="admin-orders__modal-summary-row">
                    <span>Delivery partner charge:</span>
                    <span>₹{(selectedOrder.deliveryPartnerCharge ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="admin-orders__modal-summary-row">
                    <span>Handling bag:</span>
                    <span>₹{(selectedOrder.handlingBagCharge ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="admin-orders__modal-summary-row">
                    <span>Taxes & charges:</span>
                    <span>₹{(selectedOrder.totalTax ?? ((selectedOrder.gstAmount ?? selectedOrder.tax ?? 0) + (selectedOrder.deliveryPartnerCharge ?? 0) + (selectedOrder.handlingBagCharge ?? 0))).toFixed(2)}</span>
                  </div>
                  {selectedOrder.promoCode && selectedOrder.discountAmount > 0 && (
                    <div className="admin-orders__modal-summary-row admin-orders__modal-summary-row--discount">
                      <span>Discount ({selectedOrder.promoCode}):</span>
                      <span>-₹{selectedOrder.discountAmount?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="admin-orders__modal-summary-row admin-orders__modal-summary-row--total">
                    <span>Total:</span>
                    <span>₹{selectedOrder.total?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

                <div className="admin-orders__modal-section">
                  <h3>Order Status</h3>
                  <div className="admin-orders__modal-status">
                    <div className="admin-orders__modal-status-current">
                      <span>Current:</span>
                      <span 
                        className="admin-orders__status-badge"
                        style={{ backgroundColor: getStatusInfo(selectedOrder.status).color }}
                      >
                        {getStatusInfo(selectedOrder.status).label}
                      </span>
                    </div>
                    <div className="admin-orders__modal-status-change">
                      <span>Change to:</span>
                      <div className="admin-orders__status-buttons">
                        {orderStatuses.map(status => (
                          <button
                            key={status.value}
                            className={`admin-orders__status-btn ${selectedOrder.status === status.value ? 'admin-orders__status-btn--active' : ''}`}
                            style={{ 
                              backgroundColor: selectedOrder.status === status.value ? status.color : 'transparent',
                              borderColor: status.color,
                              color: selectedOrder.status === status.value ? 'white' : status.color
                            }}
                            onClick={() => {
                              handleStatusChange(selectedOrder.id, status.value);
                              setSelectedOrder(prev => ({ ...prev, status: status.value }));
                            }}
                            disabled={updating === selectedOrder.id || selectedOrder.status === status.value}
                          >
                            {updating === selectedOrder.id ? (
                              <FaSpinner className="admin-orders__btn-spinner" />
                            ) : (
                              <>
                                <status.icon />
                                {status.label}
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-orders__modal-section admin-orders__modal-timestamps">
                  <p><strong>Order Date:</strong> {formatDate(selectedOrder.createdAt)}</p>
                  {selectedOrder.updatedAt && (
                    <p><strong>Last Updated:</strong> {formatDate(selectedOrder.updatedAt)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;
