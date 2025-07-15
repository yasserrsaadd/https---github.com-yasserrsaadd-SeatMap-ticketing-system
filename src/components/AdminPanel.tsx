import React, { useState } from 'react';
import { Settings, Plus, Trash2, Edit3, Save, X, DollarSign, Users, RotateCw, Square } from 'lucide-react';
import DragDropAdmin from './DragDropAdmin';

const predefinedColors = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
  '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
  '#c44569', '#f8b500', '#6c5ce7', '#a29bfe', '#fd79a8',
  '#e17055', '#00b894', '#0984e3', '#6c5ce7', '#fdcb6e'
];

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
  seats: any[];
  shape: 'rounded' | 'sided';
}

interface AdminPanelProps {
  sectors: Sector[];
  onSectorsUpdate: (sectors: Sector[]) => void;
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
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
  dragPreview: { x: number; y: number } | null;
  onDragPreviewChange: (preview: { x: number; y: number } | null) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  sectors,
  onSectorsUpdate,
  isAdminMode,
  onToggleAdminMode,
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
  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [newSectorName, setNewSectorName] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sectors' | 'dragdrop' | 'pricing'>('sectors');

  const updateSector = (sectorId: string, updates: Partial<Sector>) => {
    const updatedSectors = sectors.map(sector =>
      sector.id === sectorId ? { ...sector, ...updates } : sector
    );
    onSectorsUpdate(updatedSectors);
  };

  const deleteSector = (sectorId: string) => {
    const updatedSectors = sectors.filter(sector => sector.id !== sectorId);
    onSectorsUpdate(updatedSectors);
  };

  const addNewSector = () => {
    const newSector: Sector = {
      id: `sector-${Date.now()}`,
      name: 'New Sector',
      startAngle: 0,
      endAngle: Math.PI / 4,
      innerRadius: 150,
      outerRadius: 250,
      color: predefinedColors[sectors.length % predefinedColors.length],
      basePrice: 100,
      premiumPrice: 200,
      seats: [],
      shape: 'rounded'
    };
    onSectorsUpdate([...sectors, newSector]);
  };

  const renameSector = (sectorId: string, newName: string) => {
    updateSector(sectorId, { name: newName });
    setEditingSector(null);
    setNewSectorName('');
  };

  if (!isAdminMode) {
    return (
      <button
        onClick={onToggleAdminMode}
        className="fixed top-4 right-4 bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-lg shadow-lg transition-colors z-50"
        title="Enter Admin Mode"
      >
        <Settings className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
      {/* Admin Panel Sidebar */}
      <div className="w-96 bg-gray-900 text-white p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-orange-400">Admin Mode</h2>
          <button
            onClick={onToggleAdminMode}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('sectors')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'sectors' 
                ? 'bg-orange-600 text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Sectors
          </button>
          <button
            onClick={() => setActiveTab('dragdrop')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'dragdrop' 
                ? 'bg-orange-600 text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Drag & Drop
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'pricing' 
                ? 'bg-orange-600 text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Pricing
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'sectors' && (
          <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Sector Management</h3>
            <button
              onClick={addNewSector}
              className="bg-green-600 hover:bg-green-700 p-2 rounded-lg transition-colors"
              title="Add New Sector"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {sectors.map(sector => (
              <div
                key={sector.id}
                className={`bg-gray-800 rounded-lg p-4 border-2 transition-colors ${
                  selectedSector === sector.id ? 'border-orange-500' : 'border-transparent'
                }`}
              >
                {/* Sector Header */}
                <div className="flex justify-between items-center mb-3">
                  {editingSector === sector.id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        value={newSectorName}
                        onChange={(e) => setNewSectorName(e.target.value)}
                        className="bg-gray-700 text-white px-2 py-1 rounded flex-1"
                        placeholder={sector.name}
                        autoFocus
                      />
                      <button
                        onClick={() => renameSector(sector.id, newSectorName || sector.name)}
                        className="text-green-400 hover:text-green-300"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: sector.color }}
                      />
                      <span className="font-medium">{sector.name}</span>
                      <button
                        onClick={() => {
                          setEditingSector(sector.id);
                          setNewSectorName(sector.name);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => deleteSector(sector.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sector Shape */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-300 mb-1">Shape</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSector(sector.id, { shape: 'rounded' })}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                        sector.shape === 'rounded' 
                          ? 'bg-orange-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <RotateCw className="w-3 h-3" />
                      Rounded
                    </button>
                    <button
                      onClick={() => updateSector(sector.id, { shape: 'sided' })}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                        sector.shape === 'sided' 
                          ? 'bg-orange-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <Square className="w-3 h-3" />
                      Sided
                    </button>
                  </div>
                </div>

                {/* Color Selection */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-300 mb-1">Color</label>
                  <div className="flex gap-1 flex-wrap">
                    {predefinedColors.map(color => (
                      <button
                        key={color}
                        onClick={() => updateSector(sector.id, { color })}
                        className={`w-6 h-6 rounded border-2 transition-all ${
                          sector.color === color ? 'border-white scale-110' : 'border-gray-600'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Geometry Controls */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Inner Radius</label>
                    <input
                      type="range"
                      min="100"
                      max="200"
                      value={sector.innerRadius}
                      onChange={(e) => updateSector(sector.id, { innerRadius: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-400">{sector.innerRadius}px</span>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Outer Radius</label>
                    <input
                      type="range"
                      min="200"
                      max="350"
                      value={sector.outerRadius}
                      onChange={(e) => updateSector(sector.id, { outerRadius: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-400">{sector.outerRadius}px</span>
                  </div>
                </div>

                {/* Angle Controls */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Angle</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={(sector.startAngle * 180 / Math.PI + 360) % 360}
                      onChange={(e) => updateSector(sector.id, { 
                        startAngle: (parseInt(e.target.value) * Math.PI / 180) 
                      })}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-400">{Math.round((sector.startAngle * 180 / Math.PI + 360) % 360)}°</span>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Angle</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={(sector.endAngle * 180 / Math.PI + 360) % 360}
                      onChange={(e) => updateSector(sector.id, { 
                        endAngle: (parseInt(e.target.value) * Math.PI / 180) 
                      })}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-400">{Math.round((sector.endAngle * 180 / Math.PI + 360) % 360)}°</span>
                  </div>
                </div>

                {/* Pricing Controls */}
                <div className="border-t border-gray-700 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium">Pricing</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Base Price</label>
                      <input
                        type="number"
                        value={sector.basePrice}
                        onChange={(e) => updateSector(sector.id, { basePrice: parseInt(e.target.value) || 0 })}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Premium Price</label>
                      <input
                        type="number"
                        value={sector.premiumPrice}
                        onChange={(e) => updateSector(sector.id, { premiumPrice: parseInt(e.target.value) || 0 })}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Select Sector Button */}
                <button
                  onClick={() => setSelectedSector(selectedSector === sector.id ? null : sector.id)}
                  className={`w-full mt-3 py-2 rounded transition-colors ${
                    selectedSector === sector.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {selectedSector === sector.id ? 'Selected' : 'Select for Editing'}
                </button>
              </div>
            ))}
          </div>
          </div>
        )}

        {activeTab === 'dragdrop' && (
          <DragDropAdmin
            sectors={sectors}
            onSectorsUpdate={onSectorsUpdate}
            viewState={viewState}
            isDragMode={isDragMode}
            onToggleDragMode={onToggleDragMode}
            draggedSector={draggedSector}
            onDraggedSectorChange={onDraggedSectorChange}
            dragOffset={dragOffset}
            onDragOffsetChange={onDragOffsetChange}
            dragPreview={dragPreview}
            onDragPreviewChange={onDragPreviewChange}
            showGrid={showGrid}
            onShowGridChange={onShowGridChange}
          />
        )}

        {activeTab === 'pricing' && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Pricing Management</h3>
            
            {/* Bulk Pricing Actions */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  const updatedSectors = sectors.map(sector => ({
                    ...sector,
                    basePrice: Math.round(sector.basePrice * 0.9),
                    premiumPrice: Math.round(sector.premiumPrice * 0.9)
                  }));
                  onSectorsUpdate(updatedSectors);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors"
              >
                Apply 10% Discount to All
              </button>
              <button
                onClick={() => {
                  const updatedSectors = sectors.map(sector => ({
                    ...sector,
                    basePrice: Math.round(sector.basePrice * 1.1),
                    premiumPrice: Math.round(sector.premiumPrice * 1.1)
                  }));
                  onSectorsUpdate(updatedSectors);
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded transition-colors"
              >
                Increase All Prices 10%
              </button>
              <button
                onClick={() => {
                  const updatedSectors = sectors.map(sector => ({
                    ...sector,
                    basePrice: 100,
                    premiumPrice: 200
                  }));
                  onSectorsUpdate(updatedSectors);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded transition-colors"
              >
                Reset All Prices
              </button>
              <button
                onClick={() => onToggleDragMode()}
                className={`w-full py-2 rounded transition-colors ${
                  isDragMode 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {isDragMode ? 'Exit Drag Mode' : 'Enable Drag Mode'}
              </button>
            </div>

            {/* Individual Sector Pricing */}
            <div className="space-y-3">
              {sectors.map(sector => (
                <div key={sector.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: sector.color }}
                    />
                    <span className="font-medium">{sector.name}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Base Price</label>
                      <input
                        type="number"
                        value={sector.basePrice}
                        onChange={(e) => updateSector(sector.id, { basePrice: parseInt(e.target.value) || 0 })}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Premium Price</label>
                      <input
                        type="number"
                        value={sector.premiumPrice}
                        onChange={(e) => updateSector(sector.id, { premiumPrice: parseInt(e.target.value) || 0 })}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions - Always visible */}
        <div className="border-t border-gray-700 pt-6 mt-8">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                const resetSectors = sectors.map(sector => ({
                  ...sector,
                  shape: 'rounded' as const
                }));
                onSectorsUpdate(resetSectors);
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded transition-colors"
            >
              Reset All to Rounded
            </button>
            <button
              onClick={() => setActiveTab('dragdrop')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded transition-colors"
            >
              Open Drag & Drop Editor
            </button>
          </div>
        </div>
      </div>

      {/* Instructions Overlay */}
      <div className="flex-1 flex items-start justify-center pt-8">
        <div className="bg-gray-900 bg-opacity-95 text-white p-6 rounded-lg max-w-md">
            {isDragMode && (
              <div className="mb-4 p-3 bg-orange-600 bg-opacity-20 border border-orange-500 rounded-lg">
                <h4 className="font-semibold text-orange-400 mb-2">🎯 Drag Mode Active</h4>
                <ul className="text-orange-200 text-sm space-y-1">
                  <li>• Click and drag sectors to reposition</li>
                  <li>• Grid lines help with alignment</li>
                  <li>• Red outline = invalid position</li>
                  <li>• Green outline = valid position</li>
                  <li>• ESC key cancels current drag</li>
                </ul>
              </div>
            )}
          <h3 className="text-lg font-bold mb-4 text-orange-400">Admin Mode Instructions</h3>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold text-white mb-1">Sector Management:</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Use sliders to adjust sector size and position</li>
                <li>• Click edit icon to rename sectors</li>
                <li>• Choose between rounded or sided shapes</li>
                  <li>• Enable drag mode for visual repositioning</li>
                <li>• Delete unwanted sectors with trash icon</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Pricing Setup:</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Set base and premium prices per sector</li>
                <li>• Use quick actions for bulk price changes</li>
                <li>• Apply discounts or increases to all sectors</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Visual Customization:</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Select from predefined color palette</li>
                <li>• Adjust inner and outer radius</li>
                  <li>• Drag sectors for precise positioning</li>
                <li>• Modify start and end angles</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Drag Mode Overlay for Main Canvas */}
      {isDragMode && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-40 pointer-events-none">
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span className="font-semibold">Drag Mode Active - Click sectors to move them</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;