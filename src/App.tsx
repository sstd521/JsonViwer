import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Copy, Download, Code, ChevronDown, ChevronRight, FileText, Trash2, Expand, Minimize, Edit3, Check, X, Settings } from 'lucide-react';

interface JsonNode {
  key: string;
  value: any;
  type: string;
  isExpanded: boolean;
  level: number;
  path: string[];
}

function App() {
  // ... [rest of the code remains the same until the return statement]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-2">
          <Code className="text-blue-600" size={28} />
          <h1 className="text-xl font-bold text-gray-800 truncate">JSON 格式化工具</h1>
        </div>
      </div>

      {/* Main Content - Four Column Layout */}
      <div className="flex h-[calc(100vh-72px)]">
        {/* Column 1: Input Area */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          {/* ... [input area content] ... */}
        </div>

        {/* Column 2: Tree Structure */}
        <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
          {/* ... [tree structure content] ... */}
        </div>

        {/* Column 3: Formatted Code */}
        <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
          {/* ... [formatted code content] ... */}
        </div>

        {/* Column 4: Properties Panel */}
        <div className="w-72 bg-white flex flex-col">
          {/* ... [properties panel content] ... */}
        </div>
      </div>
    </div>
  );
}

export default App;