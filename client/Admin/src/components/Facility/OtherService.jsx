import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import styles from "./OtherService.module.css";
import { getAllAddons, createAddon, deleteAddon, updateManyAddons, searchAddons } from "../../apis/addonsApi";

const cloneAddons = (addons) => addons.map(addon => ({ ...addon }));

export default function OtherService({ onEdit, editable, onSave, onCancel, searchQuery }) {
  const [services, setServices] = useState([]);
  const [originalServices, setOriginalServices] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const menuRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        
        let response;
        if (query && query.trim()) {
          response = await searchAddons({ query: query.trim() });
        } else {
          response = await getAllAddons();
        }
        
        const addons = response.addons || response.data?.addons || [];
        
        if (response.status === 200 && addons.length >= 0) {
          const formattedAddons = addons.map(addon => ({
            id: addon._id,
            name: addon.name,
            price: `P${Number(addon.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
            unit: addon.unit
          }));
          setServices(formattedAddons);
          setOriginalServices(cloneAddons(formattedAddons));
        } else {
          throw new Error(response.error || response.data?.error || 'Failed to fetch addons');
        }
      } catch (err) {
        setError(err.message);
        setServices([]);
        setOriginalServices([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (index, field, value) => {
    const updated = [...services];
    if (field === 'price') {
      if (value === '') {
        updated[index][field] = '';
        setServices(updated);
        return;
      }
      const numericValue = value.replace(/[^0-9.]/g, '');
      const parts = numericValue.split('.');
      let cleanValue = parts[0];
      if (parts.length > 1) {
        cleanValue += '.' + parts.slice(1).join('');
      }
      if (cleanValue && !isNaN(parseFloat(cleanValue))) {
        const formattedPrice = `P${Number(cleanValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
        updated[index][field] = formattedPrice;
      } else if (numericValue === '') {
        updated[index][field] = '';
      }
    } else {
      updated[index][field] = value;
    }
    
    setServices(updated);
  };

  const handleAddNewItem = () => {
    const newItem = {
      id: null,
      name: '',
      price: 'P0.00',
      unit: 'pc'
    };
    setServices([...services, newItem]);
  };

  const handleRemoveItem = (index) => {
    const updated = services.filter((_, i) => i !== index);
    setServices(updated);
  };

  const handleSave = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError('You must be logged in to edit add-ons');
      return;
    }
    for (let i = 0; i < services.length; i++) {
      const item = services[i];
      if (!item.name || item.name.trim() === '') {
        setError(`Item ${i + 1}: Name is required`);
        return;
      }
      if (!item.unit || item.unit.trim() === '') {
        setError(`Item ${i + 1}: Unit is required`);
        return;
      }
      const price = parsePrice(item.price);
      if (price < 0) {
        setError(`Item ${i + 1}: Price must be a valid positive number`);
        return;
      }
    }
    
    try {
      setLoading(true);
      setError(null);
      const changes = [];
      
      for (let i = 0; i < services.length; i++) {
        const current = services[i];
        const original = originalServices.find(orig => orig.id === current.id);
        
        if (current.id && original) {
          const currentPrice = parsePrice(current.price);
          const originalPrice = parsePrice(original.price);
          
          if (current.name !== original.name || 
              currentPrice !== originalPrice || 
              current.unit !== original.unit) {
            changes.push({
              type: 'update',
              id: current.id,
              data: {
                name: current.name,
                price: currentPrice,
                unit: current.unit
              }
            });
          }
        } else if (!current.id) {
          changes.push({
            type: 'create',
            data: {
              name: current.name,
              price: parsePrice(current.price),
              unit: current.unit
            }
          });
        }
      }
      for (const original of originalServices) {
        const stillExists = services.find(current => current.id === original.id);
        if (!stillExists) {
          changes.push({
            type: 'delete',
            id: original.id
          });
        }
      }
      
      if (changes.length === 0) {
        const response = await getAllAddons();
        const addons = response.addons || response.data?.addons || [];
        let formattedAddons = cloneAddons(services);
        
        if (response.status === 200 && addons.length >= 0) {
          formattedAddons = addons.map(addon => ({
            id: addon._id,
            name: addon.name,
            price: `P${Number(addon.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
            unit: addon.unit
          }));
          setServices(formattedAddons);
          setOriginalServices(cloneAddons(formattedAddons));
        }
        
        if (onSave) onSave(cloneAddons(formattedAddons));
        return;
      }
      const updates = changes.filter(c => c.type === 'update').map(c => ({
        id: c.id,
        name: c.data.name,
        price: c.data.price,
        unit: c.data.unit
      }));
      
      const creates = changes.filter(c => c.type === 'create');
      const deletes = changes.filter(c => c.type === 'delete');
      if (updates.length > 0) {
        const response = await updateManyAddons(updates);
        if (response?.status !== 200) {
          if (response?.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          } else if (response?.status === 403) {
            throw new Error('You do not have permission to edit add-ons.');
          } else {
            throw new Error(response?.error || response?.message || 'Failed to update addons');
          }
        }
      }
      for (const change of creates) {
        const response = await createAddon(change.data);
        if (response.status !== 201) {
          if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          } else if (response.status === 403) {
            throw new Error('You do not have permission to create add-ons.');
          } else {
            throw new Error(response.error || 'Failed to create addon');
          }
        }
      }
      for (const change of deletes) {
        const response = await deleteAddon(change.id);
        if (response.status !== 200) {
          if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          } else if (response.status === 403) {
            throw new Error('You do not have permission to delete add-ons.');
          } else {
            throw new Error(response.error || 'Failed to delete addon');
          }
        }
      }
      const response = await getAllAddons();
      const addons = response.addons || response.data?.addons || [];
      let formattedAddons = cloneAddons(services);
      
      if (response.status === 200 && addons.length >= 0) {
        formattedAddons = addons.map(addon => ({
          id: addon._id,
          name: addon.name,
          price: `P${Number(addon.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
          unit: addon.unit
        }));
        setServices(formattedAddons);
        setOriginalServices(cloneAddons(formattedAddons));
      }
      setError(null);
      setIsEditing(false);
      
      if (onSave) onSave(cloneAddons(formattedAddons));
      
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    const cleanPrice = priceStr.toString().replace(/[P,\s]/g, '');
    const parsed = parseFloat(cleanPrice);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (onEdit) onEdit();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setServices(cloneAddons(originalServices));
    setError(null);
    if (onCancel) onCancel();
  };

  if (editable || isEditing) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <span className={styles.backArrow} onClick={handleCancel}>←</span>
          <h2>OTHER SERVICE</h2>
        </div>

        <div className={styles.tableContainer}>
          <div className={`${styles.tableHeader} ${styles.tableGridEdit}`}>
            <span>EQUIPMENTS</span>
            <span className={styles.priceLabel}>PRICE</span>
            <span className={styles.unitLabel}>UNIT</span>
            <span className={styles.actionLabel} aria-hidden="true"></span>
          </div>

          <ul className={styles.tableList}>
            {services.length > 0 ? (
              services.map((item, index) => (
                <li
                  key={index}
                  className={`${styles.tableItem} ${styles.tableGridEdit}`}
                >
                  <input
                    type="text"
                    className={styles.nameInput}
                    value={item.name}
                    placeholder="Enter equipment name"
                    onChange={(e) =>
                      handleInputChange(index, "name", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className={styles.pricePill}
                    value={item.price}
                    placeholder="P0.00"
                    onChange={(e) =>
                      handleInputChange(index, "price", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className={styles.unitInput}
                    value={item.unit}
                    placeholder="pc"
                    onChange={(e) =>
                      handleInputChange(index, "unit", e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleRemoveItem(index)}
                    title="Delete item"
                  >
                    <FaTrash />
                  </button>
                </li>
              ))
            ) : (
              <li className={styles.noDataMessage}>
                No add-ons found
              </li>
            )}
          </ul>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        <div className={styles.buttonGroup}>
          <button 
            className={styles.cancelBtn} 
            onClick={handleCancel}
            disabled={loading}
          >
            CANCEL
          </button>
          <button 
            className={styles.saveBtn} 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {loading && (
        <div className={styles.loadingMessage}>
          Loading addons...
        </div>
      )}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      <div className={styles.tableContainer}>
        <div className={styles.menuWrapper} ref={menuRef}>
          <div
            className={styles.cardMenu}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ⋮
          </div>
          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownItem} onClick={handleEdit}>
                <FaEdit className={styles.icon} /> Edit
              </div>
            </div>
          )}
        </div>

        <div className={`${styles.tableHeader} ${styles.tableGridView}`}>
          <span>EQUIPMENTS</span>
          <span className={styles.priceLabel}>PRICE</span>
        </div>

        <ul className={styles.tableList}>
          {services.length > 0 ? (
            services.map((item, index) => (
              <li
                key={index}
                className={`${styles.tableItem} ${styles.tableGridView}`}
              >
                <span>{item.name}</span>
                <span className={styles.priceDisplay}>{item.price}/{item.unit}</span>
              </li>
            ))
          ) : (
            <li className={styles.noDataMessage}>
              No add-ons found
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
