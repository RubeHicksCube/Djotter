import { useState, useEffect } from 'react';

// Floating otter that appears at the bottom when scrolled to the very bottom
// Fully visible, centered, on lowest layer
export function FloatingOtterBottom() {
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;

      // Show otter when within 100px of the bottom
      setIsAtBottom(documentHeight - scrollPosition < 100);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isAtBottom ? '0' : '-500px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '400px',
        transition: 'bottom 0.5s ease-in-out',
        zIndex: -10,
        pointerEvents: 'none',
      }}
    >
      <img
        src="/images/floating-otter.png"
        alt="Otter"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

// Peeking otter that appears at the top of headers
// Positioned to the left of the date/time
export function PeekingOtterTop() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '-100px',
        transform: 'translateY(-50%)',
        width: '350px',
        height: '350px',
        zIndex: -10,
        pointerEvents: 'none',
      }}
    >
      <img
        src="/images/peeking-otter-top.png"
        alt="Otter"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

// Peeking otter that appears on the side of pages (not every card)
// Fixed to screen border, 1/4 cutoff, lowest layer background
export function PeekingOtterSide({ side = 'right' }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '300px',
        [side]: '-100px',
        transform: side === 'left' ? 'scaleX(-1)' : 'none',
        width: '400px',
        height: '400px',
        zIndex: -10,
        pointerEvents: 'none',
      }}
    >
      <img
        src="/images/peeking-otter-side.png"
        alt="Otter"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
