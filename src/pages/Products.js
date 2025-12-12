import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLikedProducts } from '../context/LikedProductsContext';
import { useCart } from '../context/CartContext';
import { useProducts } from '../hooks/useProducts';
import { getProductDiscount, hasDiscount } from '../utils/discountUtils';
import { getImageUrl } from '../utils/imageUtils';
import { MdFilterList, MdApps, MdMoreHoriz } from 'react-icons/md';
import { FaCookie, FaBreadSlice, FaPepperHot } from 'react-icons/fa';
import { GiCakeSlice, GiCroissant, GiBreadSlice, GiCupcake, GiSandwich, GiBottleVapors, GiCookie } from 'react-icons/gi';
import './Products.css';

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All Products');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedWeights, setSelectedWeights] = useState({});
  const { toggleLike, isLiked } = useLikedProducts();
  const { addToCart, cartItems, updateQuantity, isInCart, getCartTotal, cartCount } = useCart();
  const navigate = useNavigate();

  // Fetch products from API
  const { products, loading, error } = useProducts({
    category: categoryFilter !== 'All Products' ? categoryFilter : undefined,
    search: searchQuery || undefined,
  });

  // Update search query when URL parameter changes
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [searchParams]);

  // Render star rating
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <svg key={i} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ffc107" stroke="#ffc107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <svg key={i} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="url(#half)" stroke="#ffc107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="half">
                <stop offset="50%" stopColor="#ffc107" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        );
      } else {
        stars.push(
          <svg key={i} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        );
      }
    }
    return stars;
  };

  // Products are already filtered by API, but we can do additional client-side filtering if needed
  const filteredProducts = products || [];

  const handleViewDetails = (product) => {
    console.log('Product data when viewing details:', product);
    console.log('Specifications:', product.specifications);
    console.log('Specifications type:', typeof product.specifications);
    console.log('Is Map?', product.specifications instanceof Map);
    setSelectedProduct(product);
    setShowModal(true);
  };

  const getSelectedWeight = (product) => {
    return selectedWeights[product.id] || (product.weightOptions?.[0] || null);
  };

  const getPriceData = (product) => {
    const selectedWeight = getSelectedWeight(product);
    const basePrice = product.price || 0;
    const baseOriginal = product.originalPrice || basePrice;
    const useWeightPrice = selectedWeight ? selectedWeight.price : basePrice;
    const factor = basePrice > 0 && selectedWeight ? useWeightPrice / basePrice : 1;
    const weightOriginal = Math.round(baseOriginal * factor);
    const originalPrice = selectedWeight ? weightOriginal : baseOriginal;
    return { price: useWeightPrice, originalPrice, selectedWeight };
  };

  const handleWeightChange = (product, weightLabel) => {
    const option = product.weightOptions?.find((opt) => opt.label === weightLabel) || null;
    setSelectedWeights((prev) => ({
      ...prev,
      [product.id]: option,
    }));
  };

  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => setSelectedProduct(null), 300);
  };

  const handleToggleLike = (product, event) => {
    event.stopPropagation();
    toggleLike(product);
  };

  const handleAddToCart = (product, event) => {
    if (event) event.stopPropagation();
    const { price, originalPrice, selectedWeight } = getPriceData(product);
    addToCart({ ...product, price, originalPrice, selectedWeight });
  };

  // Get quantity of a product in cart
  const getProductQuantity = (productId, weightLabel) => {
    const key = `${productId}-${weightLabel || 'default'}`;
    const cartItem = cartItems.find(item => `${item.id}-${item.selectedWeight?.label || 'default'}` === key);
    return cartItem ? cartItem.quantity : 0;
  };

  // Handle quantity change
  const handleQuantityChange = (product, newQuantity, event) => {
    if (event) event.stopPropagation();
    if (newQuantity <= 0) {
      updateQuantity(product.id, 0, getSelectedWeight(product)?.label);
    } else {
      updateQuantity(product.id, newQuantity, getSelectedWeight(product)?.label);
    }
  };

  return (
    <div className="products-container">
      <div className="filter-section">
        <h2 className="filter-title">
          <MdFilterList className="filter-icon" />
          Filter by Category
        </h2>
        <button 
          className={`filter-button ${categoryFilter === 'All Products' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('All Products')}
        >
          <MdApps />
          All Products
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Cakes' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Cakes')}
        >
          <GiCakeSlice />
          Cakes
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Pastries' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Pastries')}
        >
          <GiCroissant />
          Pastries
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Bread' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Bread')}
        >
          <GiBreadSlice />
          Bread
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Cookies' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Cookies')}
        >
          <FaCookie />
          Cookies
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Dessert' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Dessert')}
        >
          <GiCupcake />
          Deserts
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Toast' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Toast')}
        >
          <FaBreadSlice />
          Toast
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Sandwich' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Sandwich')}
        >
          <GiSandwich />
          Sandwich
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Biscuits' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Biscuits')}
        >
          <GiCookie />
          Biscuits
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Namkeens' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Namkeens')}
        >
          <FaPepperHot />
          Namkeens
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Softdrinks' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Softdrinks')}
        >
          <GiBottleVapors />
          Softdrinks
        </button>
        <button 
          className={`filter-button ${categoryFilter === 'Extra More' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('Extra More')}
        >
          <MdMoreHoriz />
          Extra More
        </button>
      </div>

      <div className="products-main-content">
        <div className="products-header">
          <h1>Our Equipment</h1>
          <p>Fresh bakes and sweet treats—perfect for your special moments.</p>
        </div>

        <div className="search-section">
          <div className="search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Search products by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search-btn" 
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            {/* <div className="spinner" style={{ margin: '0 auto', width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div> */}
            <video
                src={`${process.env.PUBLIC_URL}/loadingimg1.mp4`}
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '220px', display: 'block', margin: '0 auto 12px',backgroundColor: 'white' }}
              />
            <p style={{ marginTop: '20px', fontSize: '18px', color: '#666' }}>Loading products...</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ff6b6b' }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>Error loading products</p>
            <p style={{ fontSize: '14px', color: '#666' }}>{error}</p>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>Please check your backend server is running.</p>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: '18px', color: '#666' }}>No products found</p>
            <p style={{ fontSize: '14px', color: '#999', marginTop: '10px' }}>Try adjusting your search or filters</p>
          </div>
        )}

        <div className="products-grid">
        {!loading && !error && filteredProducts.map(product => (
          <div key={product.id} className={`product-card ${product.inStock === false ? 'sold-out' : ''}`}>
            <div className="product-image">
              <img src={getImageUrl(product.image)} alt={product.name} className="product-img" />
              {product.inStock === false && (
                <div className="sold-out-overlay">
                  <div className="sold-out-badge">SOLD OUT</div>
                </div>
              )}
              {hasDiscount(product) && (
                <div className="discount-badge">{getProductDiscount(product)}%</div>
              )}
              <div className="product-actions">
                <button 
                  className={`like-icon-btn ${isLiked(product.id) ? 'liked' : ''}`}
                  onClick={(e) => handleToggleLike(product, e)}
                  title={isLiked(product.id) ? "Unlike" : "Like"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isLiked(product.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
                <button 
                  className="view-icon-btn" 
                  onClick={() => handleViewDetails(product)}
                  title="View Details"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>
            <div className="product-info">
              <div className="product-category">{product.category}</div>
              <h3>{product.name}</h3>
              <div className="product-rating">
                <div className="stars">{renderStars(product.rating)}</div>
                <span className="rating-value">{product.rating}</span>
                <span className="review-count">({product.reviews} reviews)</span>
              </div>
              {/* <p>{product.shortDescription}</p> */}
              {product.weightOptions?.length > 0 && (
                <div className="weight-selector">
                  <label htmlFor={`weight-${product.id}`}>Weight</label>
                  <select
                    id={`weight-${product.id}`}
                    value={getSelectedWeight(product)?.label || ''}
                    onChange={(e) => handleWeightChange(product, e.target.value)}
                  >
                    {product.weightOptions.map((option) => (
                      <option key={option.label} value={option.label}>
                        {option.label} - ₹{option.price}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* {getSelectedWeight(product)?.label && (
                <div className="selected-weight-pill">
                  {getSelectedWeight(product).label}
                </div>
              )} */}
              <div className="product-footer">
                <div className="price-section">
                  {(() => {
                    const { price, originalPrice } = getPriceData(product);
                    const showDiscount = originalPrice > price;
                    if (showDiscount) {
                      return (
                        <>
                          <span className="original-price">₹{originalPrice}</span>
                          <span className="product-price">₹{price}</span>
                        </>
                      );
                    }
                    return <span className="product-price">₹{price}</span>;
                  })()}
                </div>
                {product.inStock === false ? (
                  <button 
                    className="add-to-cart-btn sold-out-btn"
                    disabled
                  >
                    Sold Out
                  </button>
                ) : isInCart(product.id, getSelectedWeight(product)?.label) && getProductQuantity(product.id, getSelectedWeight(product)?.label) > 0 ? (
                  <div className="quantity-selector">
                    <button 
                      className="quantity-btn minus-btn"
                      onClick={(e) => handleQuantityChange(product, getProductQuantity(product.id, getSelectedWeight(product)?.label) - 1, e)}
                      aria-label="Decrease quantity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                    <span className="quantity-value">{getProductQuantity(product.id, getSelectedWeight(product)?.label)}</span>
                    <button 
                      className="quantity-btn plus-btn"
                      onClick={(e) => handleQuantityChange(product, getProductQuantity(product.id, getSelectedWeight(product)?.label) + 1, e)}
                      aria-label="Increase quantity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button 
                    className="add-to-cart-btn"
                    onClick={(e) => handleAddToCart(product, e)}
                  >
                    Add to Cart
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Modal for Product Details */}
      {showModal && selectedProduct && (
        <div className={`modal-overlay ${showModal ? 'active' : ''}`} onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div className="modal-header">
              <div className="modal-icon">
                <img src={getImageUrl(selectedProduct.image)} alt={selectedProduct.name} className="modal-product-img" />
              </div>
              <div className="modal-title-section">
                <span className="modal-category">{selectedProduct.category}</span>
                <h2>{selectedProduct.name}</h2>
                <div className="modal-rating">
                  <div className="stars">{renderStars(selectedProduct.rating)}</div>
                  <span className="rating-value">{selectedProduct.rating}</span>
                  <span className="review-count">({selectedProduct.reviews} reviews)</span>
                </div>
              {(() => {
                const { price, originalPrice } = getPriceData(selectedProduct);
                const showDiscount = originalPrice > price;
                return (
                  <div className="modal-price-section">
                    {showDiscount && (
                      <span className="modal-original-price">₹{originalPrice}</span>
                    )}
                    <span className="modal-price">₹{price}<span className="price-period"></span></span>
                    {showDiscount && (
                      <span className="modal-discount-badge">
                        Save {Math.round(((originalPrice - price) / originalPrice) * 100)}%
                      </span>
                    )}
                  </div>
                );
              })()}
                {selectedProduct.weightOptions?.length > 0 && (
                  <div className="weight-selector modal-weight-selector">
                    <label htmlFor={`modal-weight-${selectedProduct.id}`}>Select weight</label>
                    <select
                      id={`modal-weight-${selectedProduct.id}`}
                      value={getSelectedWeight(selectedProduct)?.label || ''}
                      onChange={(e) => handleWeightChange(selectedProduct, e.target.value)}
                    >
                      {selectedProduct.weightOptions.map((option) => (
                        <option key={option.label} value={option.label}>
                          {option.label} - ₹{option.price}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-section">
                <h3>Description</h3>
                <p>{selectedProduct.fullDescription}</p>
              </div>

              <div className="modal-section">
                <h3>Key Features</h3>
                <ul className="features-list">
                  {selectedProduct.features.map((feature, index) => (
                    <li key={index}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="modal-section">
                <h3>Specifications</h3>
                <div className="specifications-grid">
                  {(() => {
                    // Handle different formats of specifications
                    let specs = selectedProduct.specifications;
                    
                    // If it's a Map, convert to object
                    if (specs instanceof Map) {
                      specs = Object.fromEntries(specs);
                    }
                    
                    // If it's null or undefined, use empty object
                    if (!specs) {
                      specs = {};
                    }
                    
                    // If it's already an object, ensure it's a plain object
                    if (typeof specs === 'object' && !Array.isArray(specs)) {
                      const keys = Object.keys(specs);
                      if (keys.length > 0) {
                        return keys.map((key) => (
                          <div key={key} className="spec-item">
                            <span className="spec-label">{key}:</span>
                            <span className="spec-value">{specs[key]}</span>
                          </div>
                        ));
                      }
                    }
                    
                    return <p style={{ color: '#999', fontStyle: 'italic' }}>No specifications available</p>;
                  })()}
                </div>
              </div>

              <div className="modal-footer">
                {selectedProduct.inStock === false ? (
                  <button 
                    className="modal-cart-btn sold-out-btn"
                    disabled
                  >
                    Sold Out
                  </button>
                ) : isInCart(selectedProduct.id, getSelectedWeight(selectedProduct)?.label) && getProductQuantity(selectedProduct.id, getSelectedWeight(selectedProduct)?.label) > 0 ? (
                  <div className="modal-quantity-selector">
                    <button 
                      className="modal-quantity-btn minus-btn"
                      onClick={() => handleQuantityChange(selectedProduct, getProductQuantity(selectedProduct.id, getSelectedWeight(selectedProduct)?.label) - 1)}
                      aria-label="Decrease quantity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                    <span className="modal-quantity-value">{getProductQuantity(selectedProduct.id, getSelectedWeight(selectedProduct)?.label)}</span>
                    <button 
                      className="modal-quantity-btn plus-btn"
                      onClick={() => handleQuantityChange(selectedProduct, getProductQuantity(selectedProduct.id, getSelectedWeight(selectedProduct)?.label) + 1)}
                      aria-label="Increase quantity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button 
                    className="modal-cart-btn"
                    onClick={() => handleAddToCart(selectedProduct)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    Add to Cart
                  </button>
                )}
                {/* <button className="modal-contact-btn">Contact Sales</button> */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Summary Banner */}
      {cartItems.length > 0 && (
        <div className="cart-summary-banner">
          <div className="cart-summary-left">
            <span className="cart-summary-price">₹ {getCartTotal().toFixed(2)}</span>
            <span className="cart-summary-separator">|</span>
            <span className="cart-summary-items">{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
          </div>
          <button 
            className="cart-summary-view-btn"
            onClick={() => navigate('/cart')}
          >
            View Cart →
          </button>
        </div>
      )}
    </div>
  );
};

export default Products;
