import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { getProductDiscount, hasDiscount } from '../utils/discountUtils';
import { getImageUrl } from '../utils/imageUtils';
import { isOrderingAllowed, getNextOrderingTime, getOrderingHoursRange } from '../utils/timeUtils';
import { FaShoppingCart, FaLock, FaHourglassHalf, FaStar, FaClipboard, FaCheck, FaTrash, FaClock, FaMoneyBillWave, FaCreditCard, FaTimes } from 'react-icons/fa';
import './Cart.css';

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, getCartTotal, loading, proceedToCheckout } = useCart();
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [generatedPromoCode, setGeneratedPromoCode] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [orderingAllowed, setOrderingAllowed] = useState(isOrderingAllowed());
  const [checkoutStatus, setCheckoutStatus] = useState({ message: '', visible: false });
  const [showFlowerEffect, setShowFlowerEffect] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);

  // Generate random promo code on component mount
  useEffect(() => {
    const generatePromoCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };
    setGeneratedPromoCode(generatePromoCode());
  }, []);

  // Check ordering hours periodically
  useEffect(() => {
    const checkOrderingHours = () => {
      setOrderingAllowed(isOrderingAllowed());
    };

    // Check immediately
    checkOrderingHours();

    // Check every minute to update the UI
    const interval = setInterval(checkOrderingHours, 60000);

    return () => clearInterval(interval);
  }, []);

  // Auto-hide checkout success message after a short duration
  useEffect(() => {
    if (!checkoutStatus.visible) return;
    const timer = setTimeout(() => {
      setCheckoutStatus({ message: '', visible: false });
    }, 4500);
    return () => clearTimeout(timer);
  }, [checkoutStatus.visible]);

  // Auto-hide floating petals effect
  useEffect(() => {
    if (!showFlowerEffect) return;
    const timer = setTimeout(() => setShowFlowerEffect(false), 4200);
    return () => clearTimeout(timer);
  }, [showFlowerEffect]);

  const subtotal = getCartTotal();
  const deliveryPartnerCharge = cartItems.length > 0 ? 39 : 0;
  const gstAmount = cartItems.length > 0 ? 9.06 : 0;
  const handlingBagCharge = cartItems.length > 0 ? 10 : 0;
  const totalTax = gstAmount + deliveryPartnerCharge + handlingBagCharge;
  const totalBeforeDiscount = subtotal + totalTax;

  // Calculate discount: 10% of total, max ₹500 (matches UI copy)
  const discountAmount = appliedPromoCode
    ? Math.min(totalBeforeDiscount * 0.03, 500)
    : 0;

  const total = totalBeforeDiscount - discountAmount;

  const handleQuantityChange = (productId, newQuantity, weightLabel) => {
    updateQuantity(productId, newQuantity, weightLabel);
  };

  const handleRemove = (productId, weightLabel) => {
    removeFromCart(productId, weightLabel);
  };

  const handleCheckoutClick = () => {
    if (cartItems.length === 0) {
      return; // Prevent checkout if cart is empty
    }

    // Check ordering hours before proceeding
    if (!isOrderingAllowed()) {
      const nextTime = getNextOrderingTime();
      showNotification(
        `Ordering is currently closed. Orders are accepted from 9:00 AM to 10:00 PM. Next available time: ${nextTime}`,
        'error'
      );
      return;
    }

    // Show payment method modal
    setShowPaymentModal(true);
    setPaymentAccepted(false);
  };

  const handleProceedToCheckout = async () => {
    if (!paymentAccepted) {
      showNotification('Please accept the payment method to proceed', 'warning');
      return;
    }

    // Reset any previous checkout banner
    setCheckoutStatus({ message: '', visible: false });

    // Close payment modal
    setShowPaymentModal(false);

    const result = await proceedToCheckout({
      promoCode: appliedPromoCode || null,
      discountAmount: discountAmount
    });

    if (result?.success) {
      setAppliedPromoCode('');
      setPromoInput('');
      setCheckoutStatus({
        message: 'Order successfully placed.',
        visible: true
      });
      setShowFlowerEffect(true);
      setPaymentAccepted(false);
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAccepted(false);
  };

  const handleApplyPromo = () => {
    const inputCode = promoInput.trim().toUpperCase();

    if (!inputCode) {
      showNotification('Please enter a promo code', 'warning');
      return;
    }

    if (inputCode === generatedPromoCode) {
      setAppliedPromoCode(inputCode);
      setPromoInput('');
      showNotification('Promo code applied successfully! 10% off (up to ₹500)', 'success');
    } else {
      showNotification('Invalid promo code', 'error');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromoCode('');
    showNotification('Promo code removed', 'info');
  };

  const handleCopyPromoCode = () => {
    navigator.clipboard.writeText(generatedPromoCode);
    showNotification('Promo code copied to clipboard!', 'success');
  };

  // Show login prompt if not authenticated
  if (!currentUser) {
    return (
      <div className="cart-container">
        <div className="empty-cart">
          <div className="empty-icon"><FaLock /></div>
          <h3>Please login to view your cart</h3>
          <p>Sign in to access your shopping cart and saved items</p>
          <a href={`${process.env.PUBLIC_URL}/`} className="continue-shopping-btn">Go to Login</a>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="cart-container">
        <div className="empty-cart">
          <div className="empty-icon"><FaHourglassHalf /></div>
          <h3>Loading your cart...</h3>
          <p>Please wait while we fetch your items</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-container">
      <div className="cart-header">
        <h1>Shopping Cart</h1>
        <p>Review your items and proceed to checkout <br />
          Delivery will be delivered within the range of 5 km.</p>
      </div>

      {showFlowerEffect && (
        <div className="flower-effect" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, idx) => (
            <span key={idx} className="petal" />
          ))}
        </div>
      )}

      {checkoutStatus.visible && (
        <div className="checkout-success">
          <div className="success-icon">
            <FaCheck />
          </div>
          <div className="success-content">
            <h3>Success!</h3>
            <p>{checkoutStatus.message}</p>
          </div>
          <div className="success-glow" aria-hidden="true" />
        </div>
      )}

      <div className="cart-content">
        <div className="cart-items-section">
          <div className="cart-items-header">
            <h2>Cart Items ({cartItems.length})</h2>
            {cartItems.length > 0 && (
              <button className="clear-cart-btn" onClick={clearCart}>
                Clear Cart
              </button>
            )}
          </div>

          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon"><FaShoppingCart /></div>
              <h3>Your cart is empty</h3>
              <p>Add some items to get started!</p>
              <a href={`${process.env.PUBLIC_URL}/products`} className="continue-shopping-btn">Continue Shopping</a>
            </div>
          ) : (
            <div className="cart-items">
              {cartItems.map(item => {
                // Handle both numeric and string price formats
                const itemPrice = typeof item.price === 'number'
                  ? item.price
                  : parseFloat(item.price.replace('₹', ''));
                const itemHasDiscount = hasDiscount(item);
                const weightLabel = item.selectedWeight?.label;

                return (
                  <div key={`${item.id}-${weightLabel || 'default'}`} className="cart-item">
                    <div className="item-icon">
                      <img src={getImageUrl(item.image)} alt={item.name} className="cart-item-img" />
                      {itemHasDiscount && (
                        <div className="cart-discount-badge">{getProductDiscount(item)}%</div>
                      )}
                    </div>
                    <div className="item-details">
                      <h3>{item.name}</h3>
                      <div className="item-info-line">
                        <span className="item-category">{item.category}</span>
                        {weightLabel && <span className="item-weight">Weight: {weightLabel}</span>}
                        <div className="item-price-section">
                          {itemHasDiscount && item.originalPrice && (
                            <span className="item-original-price">₹{item.originalPrice}</span>
                          )}
                          <span className="item-price">₹{itemPrice}</span>
                        </div>
                      </div>
                      {item.rating && (
                        <div className="item-rating">
                          <FaStar /> {item.rating} {item.reviews && `(${item.reviews} reviews)`}
                        </div>
                      )}
                    </div>
                    <div className="item-quantity">
                      {/* <button 
                        className="remove-btn mobile-remove-btn" 
                        onClick={() => handleRemove(item.id)}
                        title="Remove from cart"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button> */}
                      <button
                        className="qty-btn"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1, weightLabel)}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1, weightLabel)}
                      >
                        +
                      </button>
                    </div>
                    <div className="item-total">
                      ₹{(itemPrice * item.quantity).toFixed(2)}
                    </div>
                    {/* <button 
                        className="remove-btn mobile-remove-btn" 
                        onClick={() => handleRemove(item.id)}
                        title="Remove from cart"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button> */}
                    <button
                      className="remove-btn desktop-remove-btn"
                      onClick={() => handleRemove(item.id, weightLabel)}
                      title="Remove from cart"
                    >
                      <FaTrash className="delete-icon" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cart-summary">
          <h2>Order Summary</h2>

          {!orderingAllowed && (
            <div className="ordering-hours-notice" style={{
              padding: '12px 16px',
              marginBottom: '16px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#856404'
            }}>
              <FaClock style={{ fontSize: '18px' }} />
              <div style={{ flex: 1 }}>
                <strong>Ordering Currently Closed</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
                  Orders are accepted from {getOrderingHoursRange()}. Next available time: {getNextOrderingTime()}
                </p>
              </div>
            </div>
          )}

          {orderingAllowed && (
            <div className="ordering-hours-info" style={{
              padding: '8px 16px',
              marginBottom: '16px',
              backgroundColor: '#d4edda',
              border: '1px solid #28a745',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#155724',
              fontSize: '14px'
            }}>
              <FaClock style={{ fontSize: '16px' }} />
              <span>Ordering hours: {getOrderingHoursRange()}</span>
            </div>
          )}

          <div className="summary-details">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row tax-row">
              <button
                type="button"
                className="tax-dropdown-btn"
                onClick={() => setShowTaxBreakdown((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: 'inherit',
                  cursor: 'pointer'
                }}
              >
                <span>Taxes & charges</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ₹{totalTax.toFixed(2)}
                  <span
                    className={`tax-caret ${showTaxBreakdown ? 'open' : ''}`}
                    aria-label="Toggle tax breakdown"
                    style={{ fontSize: '12px' }}
                  >
                    {showTaxBreakdown ? '▲' : '▼'}
                  </span>
                </span>
              </button>
            </div>
            {showTaxBreakdown && (
              <div className="tax-breakdown" style={{ marginTop: '8px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div className="summary-row breakdown-row" style={{ padding: '8px 10px' }}>
                  <span>GST on delivery items</span>
                  <span>₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="summary-row breakdown-row" style={{ padding: '8px 10px' }}>
                  <span>Delivery partner charge</span>
                  <span>₹{deliveryPartnerCharge.toFixed(2)}</span>
                </div>
                <div className="summary-row breakdown-row" style={{ padding: '8px 10px' }}>
                  <span>Handling bag</span>
                  <span>₹{handlingBagCharge.toFixed(2)}</span>
                </div>
              </div>
            )}
            {appliedPromoCode && (
              <div className="summary-row discount-row">
                <span>Discount ({appliedPromoCode})</span>
                <span className="discount-amount">-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="summary-row total-row">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            className={`checkout-btn ${cartItems.length === 0 || !orderingAllowed ? 'disabled' : ''}`}
            onClick={handleCheckoutClick}
            disabled={cartItems.length === 0 || !orderingAllowed}
            title={!orderingAllowed ? 'Ordering is currently closed. Orders are accepted from 9:00 AM to 10:00 PM.' : ''}
          >
            {!orderingAllowed ? 'Ordering Closed' : 'Proceed to Checkout'}
          </button>

          <div className="promo-section">
            {!appliedPromoCode ? (
              <>
                <div className="promo-code-generate">
                  <div className="promo-code-display">
                    <span className="promo-label">Your Promo Code:</span>
                    <div className="promo-code-value">
                      <span>{generatedPromoCode}</span>
                      <button
                        className="copy-promo-btn"
                        onClick={handleCopyPromoCode}
                        title="Copy promo code"
                      >
                        <FaClipboard color="white" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="promo-code">
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleApplyPromo()}
                  />
                  <button onClick={handleApplyPromo}>Apply</button>
                </div>
              </>
            ) : (
              <div className="promo-applied">
                <div className="promo-applied-info">
                  <span className="promo-check"><FaCheck /></span>
                  <span>code <strong>{appliedPromoCode}</strong> applied!</span>
                  <span className="promo-discount-text">Save ₹{discountAmount.toFixed(2)}</span>
                </div>
                <button className="remove-promo-btn" onClick={handleRemovePromo}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="payment-modal-overlay" onClick={handleClosePaymentModal}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <button className="payment-modal-close" onClick={handleClosePaymentModal}>
              <FaTimes />
            </button>
            <div className="payment-modal-header">
              <h2>Select Payment Method</h2>
              <p>Choose your preferred payment option</p>
            </div>

            <div className="payment-methods">
              {/* Cash on Delivery - Available */}
              <div className="payment-method-card active">
                <div className="payment-method-icon">
                  <FaMoneyBillWave />
                </div>
                <div className="payment-method-info">
                  <h3>Cash on Delivery</h3>
                  <p>Pay cash when your order arrives</p>
                  <span className="payment-badge available">Available</span>
                </div>
                <div className="payment-method-radio">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={true}
                    readOnly
                  />
                </div>
              </div>

              {/* Online Payment - Coming Soon */}
              <div className="payment-method-card disabled">
                <div className="payment-method-icon disabled">
                  <FaCreditCard />
                </div>
                <div className="payment-method-info">
                  <h3>Online Payment</h3>
                  <p>Pay securely with card or UPI</p>
                  <span className="payment-badge coming-soon">Coming Soon</span>
                </div>
                <div className="payment-method-radio">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="online"
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="payment-acceptance">
              <label className="payment-checkbox-label">
                <input
                  type="checkbox"
                  checked={paymentAccepted}
                  onChange={(e) => setPaymentAccepted(e.target.checked)}
                />
                <span className="payment-checkbox-text">
                  I understand that only Cash on Delivery is currently available. Online payment options will be introduced soon.
                  Delivery is available only within a 5 km radius.
                </span>
              </label>
            </div>

            <div className="payment-modal-actions">
              <button
                className="payment-cancel-btn"
                onClick={handleClosePaymentModal}
              >
                Cancel
              </button>
              <button
                className={`payment-proceed-btn ${!paymentAccepted ? 'disabled' : ''}`}
                onClick={handleProceedToCheckout}
                disabled={!paymentAccepted}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
