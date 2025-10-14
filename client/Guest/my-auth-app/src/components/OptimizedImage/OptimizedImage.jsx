import React, { useState, useRef, useEffect } from 'react';
import styles from './OptimizedImage.module.css';

function OptimizedImage({ 
  src, 
  alt, 
  className, 
  placeholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PC9zdmc+",
  loading = "lazy",
  ...props 
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start loading 50px before the image comes into view
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  return (
    <div 
      ref={imgRef} 
      className={`${styles.imageContainer} ${className || ''}`} 
      {...props}
    >
      {isInView && (
        <>
          <img
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            loading={loading}
            className={styles.mainImage}
            style={{ 
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
          {!isLoaded && !hasError && (
            <div className={styles.placeholderContainer}>
              <img
                src={placeholder}
                alt="Loading..."
                className={styles.placeholderImage}
                aria-hidden="true"
              />
              <div className={styles.loadingSpinner} role="status" aria-label="Loading image">
                <span className="sr-only">Loading image...</span>
              </div>
            </div>
          )}
          {hasError && (
            <div className={styles.errorContainer} role="alert" aria-label="Image failed to load">
              <div className={styles.errorIcon}>⚠️</div>
              <span className={styles.errorText}>Image unavailable</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default OptimizedImage;
