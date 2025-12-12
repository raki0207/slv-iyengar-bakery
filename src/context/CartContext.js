import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, getDoc, deleteDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { isOrderingAllowed, getNextOrderingTime, getOrderingHoursMessage } from '../utils/timeUtils';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Build a stable key for a cart line (product + optional weight)
  const buildCartKey = (productId, weightLabel) => {
    return `${productId}-${weightLabel || 'default'}`;
  };

  const findCartItemIndex = (items, productId, weightLabel) => {
    const key = buildCartKey(productId, weightLabel);
    return items.findIndex(
      (item) => buildCartKey(item.id, item.selectedWeight?.label) === key
    );
  };

  // Load cart items from Firestore when user logs in
  useEffect(() => {
    const loadCartFromFirestore = async () => {
      if (!currentUser) {
        // Clear cart when user logs out
        setCartItems([]);
        return;
      }

      setLoading(true);
      try {
        const cartRef = doc(db, 'carts', currentUser.uid);
        const cartDoc = await getDoc(cartRef);
        
        if (cartDoc.exists()) {
          const cartData = cartDoc.data();
          setCartItems(cartData.items || []);
          console.log('Cart loaded from Firestore');
        } else {
          // No cart exists yet, initialize empty cart
          setCartItems([]);
        }
      } catch (error) {
        console.error('Error loading cart from Firestore:', error);
        setCartItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadCartFromFirestore();
  }, [currentUser]);

  // Save cart to Firestore whenever it changes
  const saveCartToFirestore = async (items) => {
    if (!currentUser) return;

    try {
      const cartRef = doc(db, 'carts', currentUser.uid);
      await setDoc(cartRef, {
        items: items,
        userId: currentUser.uid,
        updatedAt: new Date().toISOString()
      });
      console.log('Cart saved to Firestore');
    } catch (error) {
      console.error('Error saving cart to Firestore:', error);
    }
  };

  const addToCart = async (product) => {
    if (!currentUser) {
      showNotification('Please login to add items to cart', 'warning');
      return;
    }

    const weightLabel = product?.selectedWeight?.label;
    const price = product?.price;
    const originalPrice = product?.originalPrice || price;
    const existingIndex = findCartItemIndex(cartItems, product.id, weightLabel);
    const newCartItems =
      existingIndex >= 0
        ? cartItems.map((item, index) =>
            index === existingIndex
              ? { ...item, quantity: item.quantity + 1, price, originalPrice }
              : item
          )
        : [...cartItems, { ...product, price, originalPrice, quantity: 1 }];

    setCartItems(newCartItems);
    await saveCartToFirestore(newCartItems);
  };

  const removeFromCart = async (productId, weightLabel) => {
    if (!currentUser) return;

    const key = buildCartKey(productId, weightLabel);
    const newCartItems = cartItems.filter(
      (item) => buildCartKey(item.id, item.selectedWeight?.label) !== key
    );
    setCartItems(newCartItems);
    await saveCartToFirestore(newCartItems);
  };

  const updateQuantity = async (productId, quantity, weightLabel) => {
    if (!currentUser) return;

    if (quantity <= 0) {
      await removeFromCart(productId, weightLabel);
      return;
    }

    const itemIndex = findCartItemIndex(cartItems, productId, weightLabel);
    const newCartItems =
      itemIndex >= 0
        ? cartItems.map((item, index) =>
            index === itemIndex ? { ...item, quantity } : item
          )
        : cartItems;
    setCartItems(newCartItems);
    await saveCartToFirestore(newCartItems);
  };

  const clearCart = async () => {
    if (!currentUser) return;

    setCartItems([]);
    try {
      const cartRef = doc(db, 'carts', currentUser.uid);
      await deleteDoc(cartRef);
      console.log('Cart cleared from Firestore');
    } catch (error) {
      console.error('Error clearing cart from Firestore:', error);
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      // Handle both numeric price and string price formats
      const price = typeof item.price === 'number' 
        ? item.price 
        : parseFloat(item.price.replace('₹', ''));
      return total + (price * item.quantity);
    }, 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const isInCart = (productId, weightLabel) => {
    return findCartItemIndex(cartItems, productId, weightLabel) !== -1;
  };

  const proceedToCheckout = async (discountInfo = {}) => {
    if (!currentUser) {
      showNotification('Please login to proceed with checkout', 'warning');
      return { success: false };
    }

    if (cartItems.length === 0) {
      showNotification('Your cart is empty', 'warning');
      return { success: false };
    }

    // Check if ordering is allowed at this time
    if (!isOrderingAllowed()) {
      const nextTime = getNextOrderingTime();
      showNotification(
        `Ordering is currently closed. Orders are accepted from 9:00 AM to 10:00 PM. Next available time: ${nextTime}`,
        'error'
      );
      return { success: false };
    }

    try {
      // Get user profile data
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : {};

      // Calculate totals (aligned with cart summary)
      const subtotal = getCartTotal();
      const deliveryPartnerCharge = cartItems.length > 0 ? 39 : 0;
      const gstAmount = cartItems.length > 0 ? 9.06 : 0;
      const handlingBagCharge = cartItems.length > 0 ? 10 : 0;
      const totalTax = gstAmount + deliveryPartnerCharge + handlingBagCharge;
      const totalBeforeDiscount = subtotal + totalTax;
      const discountAmount = discountInfo.discountAmount || 0;
      const total = totalBeforeDiscount - discountAmount;

      // Prepare order data
      const orderData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        items: cartItems.map(item => ({
          id: item.id,
          selectedWeight: item.selectedWeight || null,
          name: item.name,
          category: item.category,
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price.replace('₹', '')),
          quantity: item.quantity,
          image: item.image,
          discount: item.discount || 0,
          originalPrice: item.originalPrice
        })),
        subtotal,
        tax: totalTax,
        gstAmount,
        deliveryPartnerCharge,
        handlingBagCharge,
        totalTax,
        totalBeforeDiscount,
        promoCode: discountInfo.promoCode || null,
        discountAmount,
        total,
        userProfile: {
          name: userData.name || 'N/A',
          email: currentUser.email,
          phoneNumber: userData.phoneNumber || 'N/A',
          address: userData.address || 'N/A',
          city: userData.city || 'N/A',
          state: userData.state || 'N/A',
          pincode: userData.pincode || 'N/A'
        },
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Save order to Firebase
      const ordersRef = collection(db, 'orders');
      const orderDoc = await addDoc(ordersRef, orderData);
      
      console.log('Order saved with ID:', orderDoc.id);

      // Clear cart after successful checkout
      await clearCart();

      return { success: true, orderId: orderDoc.id };

    } catch (error) {
      console.error('Error during checkout:', error);
      showNotification('Failed to place order. Please try again.', 'error');
      return { success: false };
    }
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    cartCount: getCartCount(),
    isInCart,
    loading,
    proceedToCheckout
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
