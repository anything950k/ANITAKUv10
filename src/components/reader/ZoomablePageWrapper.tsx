import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ZoomablePageWrapperProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxScale?: number;
  doubleTapScale?: number;
  onZoomChange?: (isZoomed: boolean, scale: number) => void;
  disabled?: boolean;
}

export const ZoomablePageWrapper: React.FC<ZoomablePageWrapperProps> = ({
  children,
  className = '',
  style = {},
  maxScale = 4,
  doubleTapScale = 2,
  onZoomChange,
  disabled = false,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastDoubleTapTimeRef = useRef<number>(0);
  const touchActiveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTouchDeviceRef = useRef<boolean>(false);

  // Gesture tracking refs
  const stateRef = useRef({
    scale: 1,
    pan: { x: 0, y: 0 },
    isPinching: false,
    isPanning: false,
    initialDistance: 0,
    initialScale: 1,
    initialPan: { x: 0, y: 0 },
    touchStartPan: { x: 0, y: 0 },
    lastTouch: { x: 0, y: 0 },
    lastTapTime: 0,
    lastTapPos: { x: 0, y: 0 },
  });

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current.scale = scale;
    stateRef.current.pan = pan;
    if (onZoomChange) {
      onZoomChange(scale > 1.05, scale);
    }
  }, [scale, pan, onZoomChange]);

  const resetZoom = useCallback((animate = true) => {
    if (animate) setIsTransitioning(true);
    setScale(1);
    setPan({ x: 0, y: 0 });
    stateRef.current.scale = 1;
    stateRef.current.pan = { x: 0, y: 0 };
    if (animate) {
      setTimeout(() => setIsTransitioning(false), 240);
    }
  }, []);

  const setZoom = useCallback(
    (targetScale: number, centerX: number, centerY: number, animate = true) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      const clampedScale = Math.max(1, Math.min(maxScale, targetScale));

      if (clampedScale <= 1.05) {
        resetZoom(animate);
        return;
      }

      // Calculate pan offset to zoom into the tapped point
      const originX = centerX - rect.left - rect.width / 2;
      const originY = centerY - rect.top - rect.height / 2;

      // Scale factor relative to 1x
      const panFactor = clampedScale - 1;
      const targetPanX = -originX * panFactor;
      const targetPanY = -originY * panFactor;

      // Clamp pan limits so content doesn't fly out of view
      const maxPanX = (rect.width * panFactor) / 2;
      const maxPanY = (rect.height * panFactor) / 2;

      const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, targetPanX));
      const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, targetPanY));

      if (animate) setIsTransitioning(true);
      setScale(clampedScale);
      setPan({ x: clampedPanX, y: clampedPanY });
      stateRef.current.scale = clampedScale;
      stateRef.current.pan = { x: clampedPanX, y: clampedPanY };

      if (animate) {
        setTimeout(() => setIsTransitioning(false), 240);
      }
    },
    [maxScale, resetZoom]
  );

  // Handle double-tap / double-click with debounce protection against browser double-firing
  const handleDoubleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      const now = Date.now();
      // Block duplicate triggers occurring within 420ms (e.g. touchstart followed by synthetic dblclick)
      if (now - lastDoubleTapTimeRef.current < 420) {
        return;
      }
      lastDoubleTapTimeRef.current = now;

      if (stateRef.current.scale > 1.1) {
        resetZoom(true);
      } else {
        setZoom(doubleTapScale, clientX, clientY, true);
      }
    },
    [disabled, doubleTapScale, resetZoom, setZoom]
  );

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;

    // Mark as touch device to prevent synthetic dblclick events from firing
    isTouchDeviceRef.current = true;
    if (touchActiveTimerRef.current) clearTimeout(touchActiveTimerRef.current);
    touchActiveTimerRef.current = setTimeout(() => {
      isTouchDeviceRef.current = false;
    }, 600);

    const touches = e.touches;

    if (touches.length === 2) {
      // Pinch gesture start
      stateRef.current.isPinching = true;
      stateRef.current.isPanning = false;
      setIsTransitioning(false);

      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      stateRef.current.initialDistance = Math.hypot(dx, dy);
      stateRef.current.initialScale = stateRef.current.scale;
      stateRef.current.initialPan = { ...stateRef.current.pan };
    } else if (touches.length === 1) {
      const now = Date.now();
      const touch = touches[0];
      const timeDiff = now - stateRef.current.lastTapTime;
      const distFromLastTap = Math.hypot(
        touch.clientX - stateRef.current.lastTapPos.x,
        touch.clientY - stateRef.current.lastTapPos.y
      );

      // Check for double tap (within 40ms to 350ms, and within 40px)
      if (timeDiff > 40 && timeDiff < 350 && distFromLastTap < 40) {
        e.preventDefault();
        e.stopPropagation();
        stateRef.current.lastTapTime = 0;
        handleDoubleTap(touch.clientX, touch.clientY);
        return;
      }

      stateRef.current.lastTapTime = now;
      stateRef.current.lastTapPos = { x: touch.clientX, y: touch.clientY };

      if (stateRef.current.scale > 1.05) {
        // Panning active zoomed content
        stateRef.current.isPanning = true;
        stateRef.current.touchStartPan = { ...stateRef.current.pan };
        stateRef.current.lastTouch = { x: touch.clientX, y: touch.clientY };
        setIsTransitioning(false);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;
    const touches = e.touches;

    if (touches.length === 2 && stateRef.current.isPinching) {
      e.preventDefault();
      e.stopPropagation();

      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const currentDistance = Math.hypot(dx, dy);

      if (stateRef.current.initialDistance > 0) {
        const factor = currentDistance / stateRef.current.initialDistance;
        const newScale = Math.max(1, Math.min(maxScale * 1.2, stateRef.current.initialScale * factor));
        setScale(newScale);
        stateRef.current.scale = newScale;
      }
    } else if (touches.length === 1 && stateRef.current.isPanning && stateRef.current.scale > 1.05) {
      e.preventDefault();
      e.stopPropagation();

      const touch = touches[0];
      const deltaX = touch.clientX - stateRef.current.lastTouch.x;
      const deltaY = touch.clientY - stateRef.current.lastTouch.y;

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentScale = stateRef.current.scale;
      const maxPanX = (rect.width * (currentScale - 1)) / 2 + 30;
      const maxPanY = (rect.height * (currentScale - 1)) / 2 + 30;

      const newPanX = Math.max(-maxPanX, Math.min(maxPanX, stateRef.current.pan.x + deltaX));
      const newPanY = Math.max(-maxPanY, Math.min(maxPanY, stateRef.current.pan.y + deltaY));

      setPan({ x: newPanX, y: newPanY });
      stateRef.current.pan = { x: newPanX, y: newPanY };
      stateRef.current.lastTouch = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (stateRef.current.isPinching && e.touches.length < 2) {
      stateRef.current.isPinching = false;
      // If scale snapped below threshold, reset smoothly
      if (stateRef.current.scale < 1.08) {
        resetZoom(true);
      } else if (stateRef.current.scale > maxScale) {
        setScale(maxScale);
        stateRef.current.scale = maxScale;
      }
    }

    if (stateRef.current.isPanning && e.touches.length === 0) {
      stateRef.current.isPanning = false;

      // Bound pan inside container
      if (containerRef.current && stateRef.current.scale > 1.05) {
        const rect = containerRef.current.getBoundingClientRect();
        const currentScale = stateRef.current.scale;
        const maxPanX = (rect.width * (currentScale - 1)) / 2;
        const maxPanY = (rect.height * (currentScale - 1)) / 2;

        const boundedX = Math.max(-maxPanX, Math.min(maxPanX, stateRef.current.pan.x));
        const boundedY = Math.max(-maxPanY, Math.min(maxPanY, stateRef.current.pan.y));

        if (boundedX !== stateRef.current.pan.x || boundedY !== stateRef.current.pan.y) {
          setIsTransitioning(true);
          setPan({ x: boundedX, y: boundedY });
          stateRef.current.pan = { x: boundedX, y: boundedY };
          setTimeout(() => setIsTransitioning(false), 200);
        }
      }
    }
  };

  // Double click support for desktop mouse users only (ignored if triggered by touch interaction)
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (isTouchDeviceRef.current) return;
    e.stopPropagation();
    handleDoubleTap(e.clientX, e.clientY);
  };

  const isZoomed = scale > 1.02;

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${isZoomed ? 'z-30' : 'z-auto'} ${className}`}
      style={{
        touchAction: isZoomed ? 'none' : 'pan-y',
        ...style,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="w-full h-full transform-gpu will-change-transform flex items-center justify-center"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isTransitioning ? 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
