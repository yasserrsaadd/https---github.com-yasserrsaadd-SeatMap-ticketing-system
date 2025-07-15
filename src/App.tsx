import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, MapPin, Users, CreditCard, ShoppingCart, Trash2 } from 'lucide-react';
import AdminPanel from './components/AdminPanel';

interface Seat {
  id: string;
  row: number;
  seatNumber: number;
  sector: string;
  x: number;
  y: number;
  status: 'available' | 'selected' | 'occupied' | 'premium';
  price: number;
}

interface Sector {
  id: string;
  name: string;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  color: string;
  basePrice: number;
  premiumPrice: number;
  seats: Seat[];
  shape: 'rounded' | 'sided';
}

interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
  centerX: number;
  centerY: number;
}

interface CartItem {
  seat: Seat;
  quantity: number;
}

const SEAT_COLORS = {
  available: '#22c55e',
  selected: '#3b82f6',
  occupied: '#ef4444',
  premium: '#f59e0b'
};

const SEAT_STATUS_NAMES = {
  available: 'Available',
  selected: 'Selected',
  occupied: 'Occupied',
  premium: 'Premium'
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState<ViewState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    centerX: 0,
    centerY: 0
  });
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [hoveredSector, setHoveredSector] = useState<Sector | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cursorStyle, setCursorStyle] = useState('default');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminDragMode, setAdminDragMode] = useState(false);
  const [adminDraggedSector, setAdminDraggedSector] = useState<string | null>(null);
  const [adminDragOffset, setAdminDragOffset] = useState({ x: 0, y: 0 });
  const [adminDragPreview, setAdminDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [adminShowGrid, setAdminShowGrid] = useState(true);
  const [adminDragHistory, setAdminDragHistory] = useState<Sector[][]>([]);
  const [adminHistoryIndex, setAdminHistoryIndex] = useState(-1);

  // Initialize stadium sectors and seats
  useEffect(() => {
    if (!isInitialized) {
      initializeStadium();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Save to admin drag history
  const saveToAdminHistory = (newSectors: Sector[]) => {
    const newHistory = adminDragHistory.slice(0, adminHistoryIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newSectors)));
    setAdminDragHistory(newHistory);
    setAdminHistoryIndex(newHistory.length - 1);
  };

  // Canvas rendering
  useEffect(() => {
    if (sectors.length > 0) {
      drawStadium();
      drawMiniMap();
    }
  }, [sectors, viewState, selectedSeats, hoveredSeat, hoveredSector]);

  // Admin drag functionality
  const getAdminSectorAtPosition = (x: number, y: number): Sector | null => {
    if (!adminDragMode) return null;
    
    const worldX = (x - viewState.offsetX) / viewState.scale;
    const worldY = (y - viewState.offsetY) / viewState.scale;
    
    const dx = worldX - viewState.centerX;
    const dy = worldY - viewState.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    for (const sector of sectors) {
      if (distance >= sector.innerRadius && distance <= sector.outerRadius) {
        let normalizedAngle = angle;
        if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
        
        let startAngle = sector.startAngle;
        let endAngle = sector.endAngle;
        
        if (startAngle < 0) startAngle += 2 * Math.PI;
        if (endAngle < 0) endAngle += 2 * Math.PI;
        
        if (startAngle > endAngle) {
          if (normalizedAngle >= startAngle || normalizedAngle <= endAngle) {
            return sector;
          }
        } else {
          if (normalizedAngle >= startAngle && normalizedAngle <= endAngle) {
            return sector;
          }
        }
      }
    }
    return null;
  };

  const checkAdminSectorCollision = (draggedSector: Sector, newAngle: number): boolean => {
    const sectorSpan = draggedSector.endAngle - draggedSector.startAngle;
    const newStartAngle = newAngle - sectorSpan / 2;
    const newEndAngle = newAngle + sectorSpan / 2;
    
    for (const sector of sectors) {
      if (sector.id === draggedSector.id) continue;
      
      // Check radius overlap
      const radiusOverlap = !(
        draggedSector.outerRadius < sector.innerRadius ||
        draggedSector.innerRadius > sector.outerRadius
      );

      if (radiusOverlap) {
        // Check angular overlap
        let normalizedNewStart = newStartAngle;
        let normalizedNewEnd = newEndAngle;
        let sectorStart = sector.startAngle;
        let sectorEnd = sector.endAngle;
        
        while (normalizedNewStart < 0) normalizedNewStart += 2 * Math.PI;
        while (normalizedNewEnd < 0) normalizedNewEnd += 2 * Math.PI;
        while (sectorStart < 0) sectorStart += 2 * Math.PI;
        while (sectorEnd < 0) sectorEnd += 2 * Math.PI;
        
        const angleOverlap = !(
          normalizedNewEnd < sectorStart || normalizedNewStart > sectorEnd
        );
        
        if (angleOverlap) return true;
      }
    }
    return false;
  };

  const snapToGrid = (angle: number): number => {
    if (!adminShowGrid) return angle;
    const gridSize = Math.PI / 12; // 15 degrees
    return Math.round(angle / gridSize) * gridSize;
  };

  const handleAdminDragStart = (sector: Sector, mouseX: number, mouseY: number) => {
    setAdminDraggedSector(sector.id);
    
    const worldX = (mouseX - viewState.offsetX) / viewState.scale;
    const worldY = (mouseY - viewState.offsetY) / viewState.scale;
    
    const sectorMidAngle = (sector.startAngle + sector.endAngle) / 2;
    const sectorMidRadius = (sector.innerRadius + sector.outerRadius) / 2;
    const sectorCenterX = viewState.centerX + sectorMidRadius * Math.cos(sectorMidAngle);
    const sectorCenterY = viewState.centerY + sectorMidRadius * Math.sin(sectorMidAngle);
    
    setAdminDragOffset({
      x: worldX - sectorCenterX,
      y: worldY - sectorCenterY
    });
  };

  const handleAdminDragMove = (mouseX: number, mouseY: number) => {
    if (!adminDraggedSector) return;
    
    const worldX = (mouseX - viewState.offsetX) / viewState.scale;
    const worldY = (mouseY - viewState.offsetY) / viewState.scale;
    
    const adjustedX = worldX - adminDragOffset.x;
    const adjustedY = worldY - adminDragOffset.y;
    
    const dx = adjustedX - viewState.centerX;
    const dy = adjustedY - viewState.centerY;
    const angle = Math.atan2(dy, dx);
    const snappedAngle = snapToGrid(angle);
    
    setAdminDragPreview({ x: adjustedX, y: adjustedY });
    
    // Update cursor based on collision
    const draggedSector = sectors.find(s => s.id === adminDraggedSector);
    if (draggedSector) {
      const hasCollision = checkAdminSectorCollision(draggedSector, snappedAngle);
      setCursorStyle(hasCollision ? 'not-allowed' : 'grabbing');
    }
  };

  const handleAdminDragEnd = () => {
    if (!adminDraggedSector || !adminDragPreview) {
      setAdminDraggedSector(null);
      setAdminDragPreview(null);
      setCursorStyle('default');
      return;
    }
    
    const draggedSector = sectors.find(s => s.id === adminDraggedSector);
    if (!draggedSector) return;
    
    const dx = adminDragPreview.x - viewState.centerX;
    const dy = adminDragPreview.y - viewState.centerY;
    const angle = Math.atan2(dy, dx);
    const snappedAngle = snapToGrid(angle);
    
    const hasCollision = checkAdminSectorCollision(draggedSector, snappedAngle);
    
    if (!hasCollision) {
      const sectorSpan = draggedSector.endAngle - draggedSector.startAngle;
      const newStartAngle = snappedAngle - sectorSpan / 2;
      const newEndAngle = snappedAngle + sectorSpan / 2;
      
      const updatedSectors = sectors.map(sector => {
        if (sector.id === adminDraggedSector) {
          return {
            ...sector,
            startAngle: newStartAngle,
            endAngle: newEndAngle
          };
        }
        return sector;
      });
      
      saveToAdminHistory(sectors); // Save current state before change
      setSectors(updatedSectors);
    }
    
    setAdminDraggedSector(null);
    setAdminDragPreview(null);
    setCursorStyle('default');
  };

  // Event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Slower zoom factor
      const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
      const newScale = Math.max(0.5, Math.min(20, viewState.scale * scaleFactor));
      
      setViewState(prev => ({
        ...prev,
        scale: newScale,
        offsetX: mouseX - (mouseX - prev.offsetX) * scaleFactor,
        offsetY: mouseY - (mouseY - prev.offsetY) * scaleFactor
      }));
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Get precise mouse coordinates relative to canvas
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      
      // Handle admin drag mode
      if (adminDragMode) {
        const sector = getAdminSectorAtPosition(mouseX, mouseY);
        if (sector) {
          handleAdminDragStart(sector, mouseX, mouseY);
          return;
        }
      }
      
      // Normal seat selection
      const seat = getSeatAtPosition(mouseX, mouseY);
      if (seat && (seat.status === 'available' || seat.status === 'premium')) {
        handleSeatClick(seat);
      } else {
        setIsDragging(true);
        setDragStart({ x: mouseX, y: mouseY });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Get precise mouse coordinates relative to canvas
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      
      // Handle admin drag mode
      if (adminDragMode && adminDraggedSector) {
        handleAdminDragMove(mouseX, mouseY);
        return;
      }
      
      if (isDragging) {
        // Slower pan movement
        const panSpeed = 0.7;
        setViewState(prev => ({
          ...prev,
          offsetX: prev.offsetX + (mouseX - dragStart.x) * panSpeed,
          offsetY: prev.offsetY + (mouseY - dragStart.y) * panSpeed
        }));
        setDragStart({ x: mouseX, y: mouseY });
        setCursorStyle('grabbing');
      } else {
        const seat = getSeatAtPosition(mouseX, mouseY);
        const sector = getSectorAtPosition(mouseX, mouseY);
        
        // Admin mode cursor handling
        if (adminDragMode && !adminDraggedSector) {
          const adminSector = getAdminSectorAtPosition(mouseX, mouseY);
          setCursorStyle(adminSector ? 'grab' : 'default');
        }
        // Normal cursor handling
        else if (seat && !selectedSeats.some(s => s.id === seat.id) && (seat.status === 'available' || seat.status === 'premium')) {
          setCursorStyle('pointer');
          setHoveredSeat(seat); // Keep for tooltip only
        } else {
          setCursorStyle('default');
          setHoveredSeat(seat && !selectedSeats.some(s => s.id === seat.id) ? seat : null);
        }
        
        setHoveredSector(sector);
      }
    };

    const handleMouseUp = () => {
      // Handle admin drag mode
      if (adminDragMode && adminDraggedSector) {
        handleAdminDragEnd();
        return;
      }
      
      setIsDragging(false);
      setCursorStyle('default');
    };

    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', () => {
      setHoveredSeat(null);
      setHoveredSector(null);
      setIsDragging(false);
      setCursorStyle('default');
    });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [viewState, isDragging, dragStart, sectors, adminDragMode, adminDraggedSector, adminDragOffset, adminShowGrid]);

  // Keyboard event listeners for admin mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && adminDraggedSector) {
        setAdminDraggedSector(null);
        setAdminDragPreview(null);
        setCursorStyle('default');
      }
    };

    if (adminDragMode) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [adminDragMode, adminDraggedSector]);

  const initializeStadium = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    setViewState(prev => ({ ...prev, centerX, centerY }));

    const sectorConfigs = [
      { name: 'Premium North Stand', startAngle: -Math.PI/6, endAngle: Math.PI/6, innerRadius: 180, outerRadius: 280, color: '#e11d48', basePrice: 250, premiumPrice: 400, shape: 'rounded' },
      { name: 'East Upper Tier', startAngle: Math.PI/6, endAngle: Math.PI/3, innerRadius: 160, outerRadius: 260, color: '#dc2626', basePrice: 180, premiumPrice: 320, shape: 'rounded' },
      { name: 'East Lower Stand', startAngle: Math.PI/3, endAngle: 2*Math.PI/3, innerRadius: 140, outerRadius: 240, color: '#ea580c', basePrice: 150, premiumPrice: 280, shape: 'sided' },
      { name: 'Family Stand', startAngle: 2*Math.PI/3, endAngle: 5*Math.PI/6, innerRadius: 160, outerRadius: 260, color: '#ca8a04', basePrice: 120, premiumPrice: 220, shape: 'rounded' },
      { name: 'South Kop', startAngle: 5*Math.PI/6, endAngle: 7*Math.PI/6, innerRadius: 180, outerRadius: 280, color: '#16a34a', basePrice: 200, premiumPrice: 350, shape: 'sided' },
      { name: 'West Upper Tier', startAngle: 7*Math.PI/6, endAngle: 4*Math.PI/3, innerRadius: 160, outerRadius: 260, color: '#0891b2', basePrice: 180, premiumPrice: 320, shape: 'rounded' },
      { name: 'West Lower Stand', startAngle: 4*Math.PI/3, endAngle: 5*Math.PI/3, innerRadius: 140, outerRadius: 240, color: '#7c3aed', basePrice: 150, premiumPrice: 280, shape: 'sided' },
      { name: 'Executive Club', startAngle: 5*Math.PI/3, endAngle: 11*Math.PI/6, innerRadius: 160, outerRadius: 260, color: '#be185d', basePrice: 300, premiumPrice: 500, shape: 'rounded' }
    ];

    const newSectors: Sector[] = sectorConfigs.map(config => {
      const sector: Sector = {
        id: config.name.toLowerCase().replace(/\s+/g, '-'),
        name: config.name,
        startAngle: config.startAngle,
        endAngle: config.endAngle,
        innerRadius: config.innerRadius,
        outerRadius: config.outerRadius,
        color: config.color,
        basePrice: config.basePrice,
        premiumPrice: config.premiumPrice,
        seats: []
      };

      // Generate seats for this sector
      const rows = Math.floor((config.outerRadius - config.innerRadius) / 12);
      const angleSpan = config.endAngle - config.startAngle;
      
      for (let row = 0; row < rows; row++) {
        const radius = config.innerRadius + (row * 12) + 6;
        const seatsInRow = Math.floor((radius * angleSpan) / 8);
        
        for (let seat = 0; seat < seatsInRow; seat++) {
          const angle = config.startAngle + (seat / seatsInRow) * angleSpan;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          
          const isPremium = Math.random() > 0.85;
          const isOccupied = Math.random() > 0.75;
          
          const seatObj: Seat = {
            id: `${sector.id}-${row}-${seat}`,
            row: row + 1,
            seatNumber: seat + 1,
            sector: sector.name,
            x,
            y,
            status: isOccupied ? 'occupied' : (isPremium ? 'premium' : 'available'),
            price: isPremium ? config.premiumPrice : config.basePrice
          };
          
          sector.seats.push(seatObj);
        }
      }

      return sector;
    });

    setSectors(newSectors);
  };

  const getSeatAtPosition = (x: number, y: number): Seat | null => {
    const transformedX = (x - viewState.offsetX) / viewState.scale;
    const transformedY = (y - viewState.offsetY) / viewState.scale;
    
    for (const sector of sectors) {
      for (const seat of sector.seats) {
        const distance = Math.sqrt(
          Math.pow(transformedX - seat.x, 2) + Math.pow(transformedY - seat.y, 2)
        );
        if (distance < 4 * Math.max(1, viewState.scale / 5)) {
          return seat;
        }
      }
    }
    return null;
  };

  const getSectorAtPosition = (x: number, y: number): Sector | null => {
    if (viewState.scale > 3) return null; // Only show sector hover at low zoom
    
    // Apply inverse transformation to get world coordinates
    const worldX = (x - viewState.offsetX) / viewState.scale;
    const worldY = (y - viewState.offsetY) / viewState.scale;
    
    const dx = worldX - viewState.centerX;
    const dy = worldY - viewState.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    for (const sector of sectors) {
      if (distance >= sector.innerRadius && distance <= sector.outerRadius) {
        let normalizedAngle = angle;
        if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
        
        let startAngle = sector.startAngle;
        let endAngle = sector.endAngle;
        
        if (startAngle < 0) startAngle += 2 * Math.PI;
        if (endAngle < 0) endAngle += 2 * Math.PI;
        
        if (startAngle > endAngle) {
          if (normalizedAngle >= startAngle || normalizedAngle <= endAngle) {
            return sector;
          }
        } else {
          if (normalizedAngle >= startAngle && normalizedAngle <= endAngle) {
            return sector;
          }
        }
      }
    }
    return null;
  };

  const handleSeatClick = (seat: Seat) => {
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    
    if (isSelected) {
      // Remove from selection and cart
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
      setCart(prev => prev.filter(item => item.seat.id !== seat.id));
    } else {
      // Add to selection and cart
      setSelectedSeats(prev => [...prev, seat]);
      setCart(prev => [...prev, { seat, quantity: 1 }]);
    }
  };

  const removeFromCart = (seatId: string) => {
    setCart(prev => prev.filter(item => item.seat.id !== seatId));
    setSelectedSeats(prev => prev.filter(s => s.id !== seatId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedSeats([]);
  };

  const drawStadium = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(viewState.offsetX, viewState.offsetY);
    ctx.scale(viewState.scale, viewState.scale);

    // Draw field
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(viewState.centerX, viewState.centerY, 120, 80, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Draw field lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(viewState.centerX, viewState.centerY, 120, 80, 0, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw center circle
    ctx.beginPath();
    ctx.arc(viewState.centerX, viewState.centerY, 30, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw sectors and seats
    sectors.forEach(sector => {
      const isHovered = hoveredSector?.id === sector.id;
      const isDraggedInAdmin = adminDraggedSector === sector.id;
      
      // Calculate display position for dragged sector
      let displayStartAngle = sector.startAngle;
      let displayEndAngle = sector.endAngle;
      
      if (isDraggedInAdmin && adminDragPreview) {
        const dx = adminDragPreview.x - viewState.centerX;
        const dy = adminDragPreview.y - viewState.centerY;
        const angle = Math.atan2(dy, dx);
        const snappedAngle = snapToGrid(angle);
        const sectorSpan = sector.endAngle - sector.startAngle;
        displayStartAngle = snappedAngle - sectorSpan / 2;
        displayEndAngle = snappedAngle + sectorSpan / 2;
      }
      
      // Draw sector outline (visible at low zoom)
      if (viewState.scale < 3) {
        // Set style based on admin drag state
        if (isDraggedInAdmin) {
          const hasCollision = adminDragPreview ? 
            checkAdminSectorCollision(sector, Math.atan2(adminDragPreview.y - viewState.centerY, adminDragPreview.x - viewState.centerX)) : 
            false;
          ctx.globalAlpha = 0.7;
          ctx.strokeStyle = hasCollision ? '#ef4444' : '#22c55e';
          ctx.lineWidth = 4;
          ctx.setLineDash([5, 5]);
        } else {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = isHovered ? '#ffffff' : sector.color;
          ctx.lineWidth = isHovered ? 4 : 3;
          ctx.setLineDash([]);
        }
        
        if (sector.shape === 'rounded') {
          // Draw rounded sector
          ctx.beginPath();
          ctx.arc(viewState.centerX, viewState.centerY, sector.innerRadius, displayStartAngle, displayEndAngle);
          ctx.arc(viewState.centerX, viewState.centerY, sector.outerRadius, displayEndAngle, displayStartAngle, true);
          ctx.closePath();
          ctx.stroke();
        } else {
          // Draw sided sector (rectangular/polygonal)
          ctx.beginPath();
          
          // Calculate corner points for sided sector
          const startX1 = viewState.centerX + sector.innerRadius * Math.cos(displayStartAngle);
          const startY1 = viewState.centerY + sector.innerRadius * Math.sin(displayStartAngle);
          const startX2 = viewState.centerX + sector.outerRadius * Math.cos(displayStartAngle);
          const startY2 = viewState.centerY + sector.outerRadius * Math.sin(displayStartAngle);
          const endX1 = viewState.centerX + sector.innerRadius * Math.cos(displayEndAngle);
          const endY1 = viewState.centerY + sector.innerRadius * Math.sin(displayEndAngle);
          const endX2 = viewState.centerX + sector.outerRadius * Math.cos(displayEndAngle);
          const endY2 = viewState.centerY + sector.outerRadius * Math.sin(displayEndAngle);
          
          // Draw sided sector as a quadrilateral
          ctx.moveTo(startX1, startY1);
          ctx.lineTo(startX2, startY2);
          ctx.lineTo(endX2, endY2);
          ctx.lineTo(endX1, endY1);
          ctx.closePath();
          ctx.stroke();
        }
        
        // Reset styles
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        
        // Draw sector name
        if (isHovered) {
          const midAngle = (displayStartAngle + displayEndAngle) / 2;
          const textRadius = (sector.innerRadius + sector.outerRadius) / 2;
          const textX = viewState.centerX + textRadius * Math.cos(midAngle);
          const textY = viewState.centerY + textRadius * Math.sin(midAngle);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(sector.name, textX, textY - 5);
          ctx.font = '12px Arial';
          ctx.fillText(`From $${sector.basePrice}`, textX, textY + 10);
        }
        
        // Draw drag indicator for admin mode
        if (isDraggedInAdmin && adminDragPreview) {
          const midAngle = (displayStartAngle + displayEndAngle) / 2;
          const textRadius = (sector.innerRadius + sector.outerRadius) / 2;
          const textX = viewState.centerX + textRadius * Math.cos(midAngle);
          const textY = viewState.centerY + textRadius * Math.sin(midAngle);
          
          const hasCollision = checkAdminSectorCollision(sector, Math.atan2(adminDragPreview.y - viewState.centerY, adminDragPreview.x - viewState.centerX));
          
          ctx.fillStyle = hasCollision ? '#ef4444' : '#22c55e';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('DRAGGING', textX, textY - 10);
          ctx.font = '10px Arial';
          ctx.fillText(hasCollision ? 'INVALID' : 'VALID', textX, textY + 5);
          
          // Draw angle info
          ctx.fillText(`${Math.round(displayStartAngle * 180 / Math.PI)}° - ${Math.round(displayEndAngle * 180 / Math.PI)}°`, textX, textY + 20);
        }
      }
      
      // Draw grid lines for admin drag mode
      if (adminDragMode && adminShowGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        // Draw radial grid lines
        for (let i = 0; i < 24; i++) {
          const angle = (i * Math.PI) / 12;
          const x1 = viewState.centerX + 100 * Math.cos(angle);
          const y1 = viewState.centerY + 100 * Math.sin(angle);
          const x2 = viewState.centerX + 350 * Math.cos(angle);
          const y2 = viewState.centerY + 350 * Math.sin(angle);
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        
        ctx.setLineDash([]);
      }

      // Draw seats (visible at higher zoom)
      if (viewState.scale > 2) {
        sector.seats.forEach(seat => {
          const isSelected = selectedSeats.some(s => s.id === seat.id);
          const isHovered = hoveredSeat?.id === seat.id;
          
          // Set seat color based on selection and hover state
          if (isSelected) {
            ctx.fillStyle = SEAT_COLORS.selected;
          } else {
            ctx.fillStyle = SEAT_COLORS[seat.status];
          }
          
          // No hover effects - clean interface
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          
          ctx.beginPath();
          // Draw seat with consistent size
          const seatRadius = 3;
          ctx.beginPath();
          ctx.arc(seat.x, seat.y, seatRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Draw seat numbers at high zoom
          if (viewState.scale > 10) {
            ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
            ctx.font = '8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(seat.seatNumber.toString(), seat.x, seat.y + 2);
          }
          
          // Debug: Draw hit area for selected seats (remove in production)
          if (isSelected && viewState.scale > 5) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(seat.x, seat.y, 6, 0, 2 * Math.PI);
            ctx.stroke();
          }
        });
      }
    });

    ctx.restore();
  };

  const drawMiniMap = () => {
    const canvas = miniMapRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 0.3;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw field
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 120 * scale, 80 * scale, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Draw sectors
    sectors.forEach(sector => {
      ctx.strokeStyle = sector.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, sector.innerRadius * scale, sector.startAngle, sector.endAngle);
      ctx.arc(centerX, centerY, sector.outerRadius * scale, sector.endAngle, sector.startAngle, true);
      ctx.closePath();
      ctx.stroke();
    });

    // Draw viewport indicator
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      centerX - (50 / viewState.scale),
      centerY - (50 / viewState.scale),
      100 / viewState.scale,
      100 / viewState.scale
    );
  };

  const handleZoomIn = () => {
    setViewState(prev => ({ ...prev, scale: Math.min(20, prev.scale * 1.1) }));
  };

  const handleZoomOut = () => {
    setViewState(prev => ({ ...prev, scale: Math.max(0.5, prev.scale * 0.9) }));
  };

  const handleResetView = () => {
    setViewState(prev => ({ ...prev, scale: 1, offsetX: 0, offsetY: 0 }));
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.seat.price * item.quantity), 0);
  const totalSeats = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSectorsUpdate = (updatedSectors: Sector[]) => {
    setSectors(updatedSectors);
    // Regenerate seats for updated sectors
    const sectorsWithSeats = updatedSectors.map(sector => {
      const sectorWithSeats = { ...sector, seats: [] };
      
      // Generate seats for this sector
      const rows = Math.floor((sector.outerRadius - sector.innerRadius) / 12);
      const angleSpan = sector.endAngle - sector.startAngle;
      
      for (let row = 0; row < rows; row++) {
        const radius = sector.innerRadius + (row * 12) + 6;
        const seatsInRow = Math.floor((radius * angleSpan) / 8);
        
        for (let seat = 0; seat < seatsInRow; seat++) {
          const angle = sector.startAngle + (seat / seatsInRow) * angleSpan;
          const x = viewState.centerX + radius * Math.cos(angle);
          const y = viewState.centerY + radius * Math.sin(angle);
          
          const isPremium = Math.random() > 0.85;
          const isOccupied = Math.random() > 0.75;
          
          const seatObj: Seat = {
            id: `${sectorWithSeats.id}-${row}-${seat}`,
            row: row + 1,
            seatNumber: seat + 1,
            sector: sectorWithSeats.name,
            x,
            y,
            status: isOccupied ? 'occupied' : (isPremium ? 'premium' : 'available'),
            price: isPremium ? sector.premiumPrice : sector.basePrice
          };
          
          sectorWithSeats.seats.push(seatObj);
        }
      }
      
      return sectorWithSeats;
    });
    
    setSectors(sectorsWithSeats);
  };

  // Update admin drag mode when admin mode changes
  useEffect(() => {
    if (!isAdminMode) {
      setAdminDragMode(false);
      setAdminDraggedSector(null);
      setAdminDragPreview(null);
    }
  }, [isAdminMode]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <AdminPanel
        sectors={sectors}
        onSectorsUpdate={handleSectorsUpdate}
        isAdminMode={isAdminMode}
        onToggleAdminMode={() => setIsAdminMode(!isAdminMode)}
        viewState={viewState}
        isDragMode={adminDragMode}
        onToggleDragMode={() => setAdminDragMode(!adminDragMode)}
        draggedSector={adminDraggedSector}
        onDraggedSectorChange={setAdminDraggedSector}
        dragOffset={adminDragOffset}
        onDragOffsetChange={setAdminDragOffset}
        dragPreview={adminDragPreview}
        onDragPreviewChange={setAdminDragPreview}
        showGrid={adminShowGrid}
        onShowGridChange={setAdminShowGrid}
      />
      
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Stadium Ticketing System</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Stadium View */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Stadium Layout</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleResetView}
                    className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="border border-gray-700 rounded-lg w-full max-w-full"
                  style={{ 
                    aspectRatio: '4/3',
                    cursor: cursorStyle
                  }}
                />
                
                {/* Hover tooltips */}
                {hoveredSeat && !selectedSeats.some(s => s.id === hoveredSeat.id) && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-90 text-white p-3 rounded-lg text-sm shadow-lg">
                    <div className="font-semibold">{hoveredSeat.sector}</div>
                    <div>Row {hoveredSeat.row}, Seat {hoveredSeat.seatNumber}</div>
                    <div className="text-green-400 font-bold">${hoveredSeat.price}</div>
                    <div className="text-xs text-gray-300">{SEAT_STATUS_NAMES[hoveredSeat.status]}</div>
                    {(hoveredSeat.status === 'available' || hoveredSeat.status === 'premium') && (
                      <div className="text-xs text-blue-300 mt-1">Click to select</div>
                    )}
                  </div>
                )}

                {hoveredSector && !hoveredSeat && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-90 text-white p-3 rounded-lg text-sm shadow-lg">
                    <div className="font-semibold">{hoveredSector.name}</div>
                    <div className="text-green-400">Standard: ${hoveredSector.basePrice}</div>
                    <div className="text-yellow-400">Premium: ${hoveredSector.premiumPrice}</div>
                    <div className="text-xs text-gray-300 mt-1">Zoom in to select seats</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Mini Map */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Navigation
              </h3>
              <canvas
                ref={miniMapRef}
                width={200}
                height={150}
                className="border border-gray-700 rounded w-full"
              />
            </div>

            {/* Legend */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Seat Legend</h3>
              <div className="space-y-2">
                {Object.entries(SEAT_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm">{SEAT_STATUS_NAMES[status as keyof typeof SEAT_STATUS_NAMES]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shopping Cart */}
            <div className="bg-gray-800 rounded-lg p-4 flex flex-col">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Shopping Cart ({totalSeats})
              </h3>
              
              {cart.length > 0 ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex-1 max-h-48 overflow-y-auto space-y-2">
                    {cart.map(item => (
                      <div key={item.seat.id} className="bg-gray-700 p-3 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.seat.sector}</div>
                            <div className="text-xs text-gray-300">
                              Row {item.seat.row}, Seat {item.seat.seatNumber}
                            </div>
                            <div className="text-green-400 font-bold">${item.seat.price}</div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.seat.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-gray-700 pt-3 mt-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-green-400 text-lg">${totalPrice}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <button 
                        onClick={() => {
                          const seatDetails = cart.map(item => 
                            `${item.seat.sector} - Row ${item.seat.row}, Seat ${item.seat.seatNumber} ($${item.seat.price})`
                          ).join('\n');
                          alert(`🎫 ORDER SUMMARY 🎫\n\n${seatDetails}\n\n📊 TOTAL: ${totalSeats} seat(s) for $${totalPrice}\n\n💳 Ready to proceed to payment!\n\n(This would redirect to secure payment processing)`);
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        Proceed to Checkout
                      </button>
                      
                      <button
                        onClick={clearCart}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Clear Cart
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Your cart is empty</p>
                  <p className="text-gray-500 text-xs mt-1">Click on available seats to add them</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">How to Use</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <h4 className="font-medium text-white mb-2">Navigation</h4>
              <ul className="space-y-1">
                <li>• Mouse wheel or zoom buttons to zoom in/out</li>
                <li>• Click and drag to pan around the stadium</li>
                <li>• Use mini-map for quick navigation</li>
                <li>• Reset button returns to overview</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Ticket Selection</h4>
              <ul className="space-y-1">
                <li>• Hover over sectors to see pricing</li>
                <li>• Zoom in to see individual seats</li>
                <li>• Cursor changes to pointer over available seats</li>
                <li>• Click available seats to select/deselect</li>
                <li>• Click selected seats to remove them</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;