import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Undo, Redo, Grid, Save, AlertTriangle, CheckCircle, RotateCcw, Move, RotateCw, Navigation } from 'lucide-react';

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

interface DragState {
  isDragging: boolean;
  draggedSector: Sector | null;
  dragOffset: { x: number; y: number };
  dragMode: 'free' | 'linear' | 'radial';
  previewPosition: { 
    startAngle: number; 
    endAngle: number;
    centerX?: number;
    centerY?: number;
  } | null;
  isValidPosition: boolean;
  dragStartPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

interface HistoryState {
  sectors: Sector[];
  timestamp: number;
}

interface SnapSettings {
  enableLinearSnap: boolean;
  enableRadialSnap: boolean;
  linearGridSize: number;
  radialGridSize: number;
  snapThreshold: number;
}

interface DragDropAdminProps {
  sectors: Sector[];
  onSectorsUpdate: (sectors: Sector[]) => void;
  viewState: {
    scale: number;
    offsetX: number;
    offsetY: number;
    centerX: number;
    centerY: number;
  };
  isDragMode: boolean;
  onToggleDragMode: () => void;
  draggedSector: string | null;
  onDraggedSectorChange: (sectorId: string | null) => void;
  dragOffset: { x: number; y: number };
  onDragOffsetChange: (offset: { x: number; y: number }) => void;
  dragPreview: any;
  onDragPreviewChange: (preview: any) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
}

const DragDropAdmin: React.FC<DragDropAdminProps> = ({
  sectors,
  onSectorsUpdate,
  viewState,
  isDragMode,
  onToggleDragMode,
  draggedSector,
  onDraggedSectorChange,
  dragOffset,
  onDragOffsetChange,
  dragPreview,
  onDragPreviewChange,
  showGrid,
  onShowGridChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedSector: null,
    dragOffset: { x: 0, y: 0 },
    dragMode: 'free',
    previewPosition: null,
    isValidPosition: true,
    dragStartPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
  });
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [showSnapGuides, setShowSnapGuides] = useState(true);
  
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
    enableLinearSnap: true,
    enableRadialSnap: true,
    linearGridSize: 20, // pixels
    radialGridSize: Math.PI / 24, // 15 degrees
    snapThreshold: 15 // pixels
  });

  // Initialize history
  useEffect(() => {
    if (history.length === 0 && sectors.length > 0) {
      const initialState: HistoryState = {
        sectors: JSON.parse(JSON.stringify(sectors)),
        timestamp: Date.now()
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, [sectors, history.length]);

  // Save state to history
  const saveToHistory = useCallback((newSectors: Sector[]) => {
    const newState: HistoryState = {
      sectors: JSON.parse(JSON.stringify(newSectors)),
      timestamp: Date.now()
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(prev => prev + 1);
    }
    
    setHistory(newHistory);
  }, [history, historyIndex]);

  // Undo/Redo functionality
  const handleUndo = () => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      onSectorsUpdate(previousState.sectors);
      setHistoryIndex(prev => prev - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      onSectorsUpdate(nextState.sectors);
      setHistoryIndex(prev => prev + 1);
    }
  };

  // Linear snapping
  const snapToLinearGrid = (value: number): number => {
    if (!snapSettings.enableLinearSnap) return value;
    return Math.round(value / snapSettings.linearGridSize) * snapSettings.linearGridSize;
  };

  // Radial snapping
  const snapToRadialGrid = (angle: number): number => {
    if (!snapSettings.enableRadialSnap) return angle;
    return Math.round(angle / snapSettings.radialGridSize) * snapSettings.radialGridSize;
  };

  // Determine drag mode based on movement
  const determineDragMode = (startPos: { x: number; y: number }, currentPos: { x: number; y: number }): 'free' | 'linear' | 'radial' => {
    const dx = currentPos.x - startPos.x;
    const dy = currentPos.y - startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 10) return 'free';
    
    const angle = Math.abs(Math.atan2(dy, dx));
    const isHorizontal = angle < Math.PI / 8 || angle > 7 * Math.PI / 8;
    const isVertical = angle > 3 * Math.PI / 8 && angle < 5 * Math.PI / 8;
    
    if (isHorizontal || isVertical) return 'linear';
    
    // Check if movement follows a circular path around center
    const centerDx = startPos.x - viewState.centerX;
    const centerDy = startPos.y - viewState.centerY;
    const startRadius = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
    
    const currentCenterDx = currentPos.x - viewState.centerX;
    const currentCenterDy = currentPos.y - viewState.centerY;
    const currentRadius = Math.sqrt(currentCenterDx * currentCenterDx + currentCenterDy * currentCenterDy);
    
    const radiusDiff = Math.abs(currentRadius - startRadius);
    
    if (radiusDiff < 30) return 'radial';
    
    return 'free';
  };

  // Check collision with other sectors
  const checkCollision = (sector: Sector, newStartAngle: number, newEndAngle: number): boolean => {
    for (const otherSector of sectors) {
      if (otherSector.id === sector.id) continue;
      
      // Check radius overlap
      const radiusOverlap = !(
        sector.outerRadius < otherSector.innerRadius ||
        sector.innerRadius > otherSector.outerRadius
      );

      if (radiusOverlap) {
        // Normalize angles
        let normalizedStart = newStartAngle;
        let normalizedEnd = newEndAngle;
        let otherStart = otherSector.startAngle;
        let otherEnd = otherSector.endAngle;
        
        while (normalizedStart < 0) normalizedStart += 2 * Math.PI;
        while (normalizedEnd < 0) normalizedEnd += 2 * Math.PI;
        while (otherStart < 0) otherStart += 2 * Math.PI;
        while (otherEnd < 0) otherEnd += 2 * Math.PI;
        
        // Check angular overlap
        const angleOverlap = !(
          normalizedEnd < otherStart || normalizedStart > otherEnd
        );
        
        if (angleOverlap) return true;
      }
    }
    return false;
  };

  // Convert mouse position to world coordinates
  const mouseToWorld = (mouseX: number, mouseY: number): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const canvasX = (mouseX - rect.left) * (canvasRef.current!.width / rect.width);
    const canvasY = (mouseY - rect.top) * (canvasRef.current!.height / rect.height);
    
    const worldX = (canvasX - viewState.offsetX) / viewState.scale;
    const worldY = (canvasY - viewState.offsetY) / viewState.scale;
    
    return { x: worldX, y: worldY };
  };

  // Convert world position to angle
  const worldToAngle = (worldX: number, worldY: number): number => {
    const dx = worldX - viewState.centerX;
    const dy = worldY - viewState.centerY;
    return Math.atan2(dy, dx);
  };

  // Get sector at position
  const getSectorAtPosition = (mouseX: number, mouseY: number): Sector | null => {
    const world = mouseToWorld(mouseX, mouseY);
    const dx = world.x - viewState.centerX;
    const dy = world.y - viewState.centerY;
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

  // Calculate new position based on drag mode
  const calculateNewPosition = (
    sector: Sector, 
    currentPos: { x: number; y: number }, 
    dragMode: string
  ): { startAngle: number; endAngle: number } => {
    const sectorSpan = sector.endAngle - sector.startAngle;
    
    if (dragMode === 'radial') {
      // Radial movement - maintain distance from center, change angle
      const angle = worldToAngle(currentPos.x, currentPos.y);
      let snappedAngle = snapToRadialGrid(angle);
      
      return {
        startAngle: snappedAngle - sectorSpan / 2,
        endAngle: snappedAngle + sectorSpan / 2
      };
    } else if (dragMode === 'linear') {
      // Linear movement - snap to grid
      const snappedX = snapToLinearGrid(currentPos.x);
      const snappedY = snapToLinearGrid(currentPos.y);
      const angle = worldToAngle(snappedX, snappedY);
      
      return {
        startAngle: angle - sectorSpan / 2,
        endAngle: angle + sectorSpan / 2
      };
    } else {
      // Free movement
      const angle = worldToAngle(currentPos.x, currentPos.y);
      
      return {
        startAngle: angle - sectorSpan / 2,
        endAngle: angle + sectorSpan / 2
      };
    }
  };

  // Mouse event handlers
  const handleMouseDown = (e: MouseEvent) => {
    const sector = getSectorAtPosition(e.clientX, e.clientY);
    if (sector) {
      const world = mouseToWorld(e.clientX, e.clientY);
      const sectorMidAngle = (sector.startAngle + sector.endAngle) / 2;
      const sectorMidRadius = (sector.innerRadius + sector.outerRadius) / 2;
      const sectorCenterX = viewState.centerX + sectorMidRadius * Math.cos(sectorMidAngle);
      const sectorCenterY = viewState.centerY + sectorMidRadius * Math.sin(sectorMidAngle);
      
      setDragState({
        isDragging: true,
        draggedSector: sector,
        dragOffset: { x: world.x - sectorCenterX, y: world.y - sectorCenterY },
        dragMode: 'free',
        previewPosition: null,
        isValidPosition: true,
        dragStartPosition: world,
        currentPosition: world
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragState.isDragging && dragState.draggedSector) {
      const world = mouseToWorld(e.clientX, e.clientY);
      const adjustedPos = {
        x: world.x - dragState.dragOffset.x,
        y: world.y - dragState.dragOffset.y
      };
      
      // Determine drag mode based on movement pattern
      const dragMode = determineDragMode(dragState.dragStartPosition, world);
      
      // Calculate new position based on drag mode
      const newPosition = calculateNewPosition(dragState.draggedSector, adjustedPos, dragMode);
      
      // Check for collisions
      const hasCollision = checkCollision(
        dragState.draggedSector, 
        newPosition.startAngle, 
        newPosition.endAngle
      );
      
      setDragState(prev => ({
        ...prev,
        dragMode,
        currentPosition: world,
        previewPosition: newPosition,
        isValidPosition: !hasCollision
      }));
    }
  };

  const handleMouseUp = () => {
    if (dragState.isDragging && dragState.draggedSector && dragState.previewPosition && dragState.isValidPosition) {
      const updatedSectors = sectors.map(sector => {
        if (sector.id === dragState.draggedSector!.id) {
          return {
            ...sector,
            startAngle: dragState.previewPosition!.startAngle,
            endAngle: dragState.previewPosition!.endAngle
          };
        }
        return sector;
      });
      
      onSectorsUpdate(updatedSectors);
      saveToHistory(updatedSectors);
    }
    
    setDragState({
      isDragging: false,
      draggedSector: null,
      dragOffset: { x: 0, y: 0 },
      dragMode: 'free',
      previewPosition: null,
      isValidPosition: true,
      dragStartPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 }
    });
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  };

  // Canvas drawing
  useEffect(() => {
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

    // Draw snap guides
    if (showGrid) {
      // Linear grid
      if (snapSettings.enableLinearSnap) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        const gridSize = snapSettings.linearGridSize;
        
        for (let x = 0; x < canvas.width / viewState.scale; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height / viewState.scale);
          ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height / viewState.scale; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width / viewState.scale, y);
          ctx.stroke();
        }
      }
      
      // Radial grid
      if (snapSettings.enableRadialSnap) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // Radial lines
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
        
        // Concentric circles
        for (let r = 100; r <= 350; r += 50) {
          ctx.beginPath();
          ctx.arc(viewState.centerX, viewState.centerY, r, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
    }

    // Draw field
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(viewState.centerX, viewState.centerY, 120, 80, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Draw sectors
    sectors.forEach(sector => {
      const isDragged = dragState.draggedSector?.id === sector.id;
      let drawStartAngle = sector.startAngle;
      let drawEndAngle = sector.endAngle;
      
      // Use preview position if dragging
      if (isDragged && dragState.previewPosition) {
        drawStartAngle = dragState.previewPosition.startAngle;
        drawEndAngle = dragState.previewPosition.endAngle;
      }
      
      // Set style based on drag state
      if (isDragged) {
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = dragState.isValidPosition ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]); // Dashed line for dragged sector
      } else {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = sector.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
      }
      
      // Draw sector based on shape
      if (sector.shape === 'rounded') {
        ctx.beginPath();
        ctx.arc(viewState.centerX, viewState.centerY, sector.innerRadius, drawStartAngle, drawEndAngle);
        ctx.arc(viewState.centerX, viewState.centerY, sector.outerRadius, drawEndAngle, drawStartAngle, true);
        ctx.closePath();
        ctx.stroke();
      } else {
        // Draw sided sector
        const startX1 = viewState.centerX + sector.innerRadius * Math.cos(drawStartAngle);
        const startY1 = viewState.centerY + sector.innerRadius * Math.sin(drawStartAngle);
        const startX2 = viewState.centerX + sector.outerRadius * Math.cos(drawStartAngle);
        const startY2 = viewState.centerY + sector.outerRadius * Math.sin(drawStartAngle);
        const endX1 = viewState.centerX + sector.innerRadius * Math.cos(drawEndAngle);
        const endY1 = viewState.centerY + sector.innerRadius * Math.sin(drawEndAngle);
        const endX2 = viewState.centerX + sector.outerRadius * Math.cos(drawEndAngle);
        const endY2 = viewState.centerY + sector.outerRadius * Math.sin(drawEndAngle);
        
        ctx.beginPath();
        ctx.moveTo(startX1, startY1);
        ctx.lineTo(startX2, startY2);
        ctx.lineTo(endX2, endY2);
        ctx.lineTo(endX1, endY1);
        ctx.closePath();
        ctx.stroke();
      }
      
      // Draw drag mode indicator
      if (isDragged) {
        const midAngle = (drawStartAngle + drawEndAngle) / 2;
        const textRadius = (sector.innerRadius + sector.outerRadius) / 2;
        const textX = viewState.centerX + textRadius * Math.cos(midAngle);
        const textY = viewState.centerY + textRadius * Math.sin(midAngle);
        
        ctx.fillStyle = dragState.isValidPosition ? '#22c55e' : '#ef4444';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(sector.name, textX, textY - 15);
        
        // Show drag mode
        const modeIcon = dragState.dragMode === 'radial' ? '↻' : 
                        dragState.dragMode === 'linear' ? '↔' : '⟲';
        ctx.font = '14px Arial';
        ctx.fillText(`${modeIcon} ${dragState.dragMode.toUpperCase()}`, textX, textY);
        
        if (showCoordinates && dragState.previewPosition) {
          ctx.font = '10px Arial';
          ctx.fillText(`Start: ${Math.round(drawStartAngle * 180 / Math.PI)}°`, textX, textY + 15);
          ctx.fillText(`End: ${Math.round(drawEndAngle * 180 / Math.PI)}°`, textX, textY + 30);
        }
      }
    });

    ctx.restore();
  }, [sectors, dragState, viewState, snapSettings, showGrid, showCoordinates]);

  // Event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Touch events for mobile support
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragState, sectors, viewState, snapSettings]);

  return (
    <div className="space-y-4">
      {/* Drag Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-orange-400">Advanced Drag & Drop Controls</h3>
        
        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={onToggleDragMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-semibold ${
              isDragMode 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            <Move className="w-4 h-4" />
            {isDragMode ? 'Exit Drag Mode' : 'Enable Drag Mode'}
          </button>
          
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              historyIndex <= 0 
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Undo className="w-4 h-4" />
            Undo
          </button>
          
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              historyIndex >= history.length - 1 
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Redo className="w-4 h-4" />
            Redo
          </button>
          
          <button
            onClick={() => onShowGridChange(!showGrid)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showGrid 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
            Grid Lines
          </button>
          
          <button
            onClick={() => setShowCoordinates(!showCoordinates)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showCoordinates 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            <Navigation className="w-4 h-4" />
            Coordinates
          </button>
        </div>

        {/* Drag Mode Status */}
        {isDragMode && (
          <div className="mb-4 p-3 bg-orange-600 bg-opacity-20 border border-orange-500 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
              <span className="font-semibold text-orange-400">Drag Mode Active</span>
            </div>
            <div className="text-sm text-orange-200">
              Click and drag sectors on the main canvas to reposition them. 
              Grid snapping is {showGrid ? 'enabled' : 'disabled'}.
            </div>
            {draggedSector && (
              <div className="mt-2 text-xs text-orange-300">
                Currently dragging: {sectors.find(s => s.id === draggedSector)?.name}
              </div>
            )}
          </div>
        )}

        {/* Snap Settings */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={snapSettings.enableLinearSnap}
                onChange={(e) => setSnapSettings(prev => ({ ...prev, enableLinearSnap: e.target.checked }))}
                className="rounded"
              />
              <Move className="w-4 h-4" />
              <span className="text-sm">Linear Snap</span>
            </label>
            <input
              type="range"
              min="10"
              max="50"
              value={snapSettings.linearGridSize}
              onChange={(e) => setSnapSettings(prev => ({ ...prev, linearGridSize: parseInt(e.target.value) }))}
              className="w-full"
              disabled={!snapSettings.enableLinearSnap}
            />
            <span className="text-xs text-gray-400">{snapSettings.linearGridSize}px grid</span>
          </div>
          
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={snapSettings.enableRadialSnap}
                onChange={(e) => setSnapSettings(prev => ({ ...prev, enableRadialSnap: e.target.checked }))}
                className="rounded"
              />
              <RotateCw className="w-4 h-4" />
              <span className="text-sm">Radial Snap</span>
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={Math.round(snapSettings.radialGridSize * 180 / Math.PI)}
              onChange={(e) => setSnapSettings(prev => ({ 
                ...prev, 
                radialGridSize: parseInt(e.target.value) * Math.PI / 180 
              }))}
              className="w-full"
              disabled={!snapSettings.enableRadialSnap}
            />
            <span className="text-xs text-gray-400">{Math.round(snapSettings.radialGridSize * 180 / Math.PI)}° grid</span>
          </div>
        </div>

        {/* Movement Mode Indicators */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Valid Position</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Invalid Position (Collision)</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-400">↻ RADIAL</span>
            <span className="text-purple-400">↔ LINEAR</span>
            <span className="text-yellow-400">⟲ FREE</span>
          </div>
        </div>

        {/* Current Drag Info */}
        {dragState.isDragging && dragState.draggedSector && (
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {dragState.isValidPosition ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <span className="font-medium">
                Dragging: {dragState.draggedSector.name}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                dragState.dragMode === 'radial' ? 'bg-blue-600' :
                dragState.dragMode === 'linear' ? 'bg-purple-600' : 'bg-yellow-600'
              }`}>
                {dragState.dragMode.toUpperCase()}
              </span>
            </div>
            {dragState.previewPosition && (
              <div className="text-sm text-gray-300">
                <div>Start Angle: {Math.round(dragState.previewPosition.startAngle * 180 / Math.PI)}°</div>
                <div>End Angle: {Math.round(dragState.previewPosition.endAngle * 180 / Math.PI)}°</div>
                <div>Movement: {Math.round(Math.sqrt(
                  Math.pow(dragState.currentPosition.x - dragState.dragStartPosition.x, 2) +
                  Math.pow(dragState.currentPosition.y - dragState.dragStartPosition.y, 2)
                ))}px</div>
                <div className={`mt-1 ${dragState.isValidPosition ? 'text-green-400' : 'text-red-400'}`}>
                  {dragState.isValidPosition ? 'Position is valid' : 'Position has collision'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Interactive Layout Editor</h3>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border border-gray-700 rounded-lg w-full cursor-grab"
          style={{ aspectRatio: '4/3', touchAction: 'none' }}
        />
      </div>

      {/* Instructions */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-orange-400">Advanced Drag & Drop Instructions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h4 className="font-semibold text-white mb-2">Movement Types:</h4>
            <ul className="space-y-1">
              <li>• <strong>Free Movement:</strong> Drag in any direction</li>
              <li>• <strong>Linear Movement:</strong> Horizontal/vertical snapping</li>
              <li>• <strong>Radial Movement:</strong> Circular paths around center</li>
              <li>• Movement type auto-detected based on drag pattern</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">Features:</h4>
            <ul className="space-y-1">
              <li>• <strong>Smart Snapping:</strong> Grid and angle alignment</li>
              <li>• <strong>Collision Detection:</strong> Prevents overlapping</li>
              <li>• <strong>Visual Feedback:</strong> Real-time position preview</li>
              <li>• <strong>Touch Support:</strong> Works on mobile devices</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <h4 className="font-semibold text-white mb-2">Browser Compatibility:</h4>
          <div className="text-xs text-gray-300 space-y-1">
            <div>• <strong>Desktop:</strong> Chrome 60+, Firefox 55+, Safari 12+, Edge 79+</div>
            <div>• <strong>Mobile:</strong> iOS Safari 12+, Chrome Mobile 60+, Samsung Internet 8+</div>
            <div>• <strong>Features:</strong> Canvas 2D, Touch Events, Pointer Events, ES6+</div>
            <div>• <strong>Performance:</strong> Optimized for 60fps on modern devices</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragDropAdmin;