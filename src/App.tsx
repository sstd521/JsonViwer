import React, { useState, useCallback, useEffect } from 'react';
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
  const [jsonInput, setJsonInput] = useState('');
  const [formattedJson, setFormattedJson] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [jsonTree, setJsonTree] = useState<JsonNode[]>([]);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isEditingFormatted, setIsEditingFormatted] = useState(false);
  const [formattedEditValue, setFormattedEditValue] = useState('');
  const [selectedNode, setSelectedNode] = useState<JsonNode | null>(null);

  const getValueType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
  };

  const buildJsonTree = useCallback((obj: any, level: number = 0, parentPath: string[] = []): JsonNode[] => {
    const nodes: JsonNode[] = [];
    
    if (obj === null) {
      nodes.push({
        key: parentPath.length > 0 ? parentPath[parentPath.length - 1] : 'root',
        value: null,
        type: 'null',
        isExpanded: false,
        level,
        path: parentPath
      });
      return nodes;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const key = `[${index}]`;
        const currentPath = [...parentPath, index.toString()];
        if (typeof item === 'object' && item !== null) {
          nodes.push({
            key,
            value: item,
            type: getValueType(item),
            isExpanded: level < 2,
            level,
            path: currentPath
          });
          nodes.push(...buildJsonTree(item, level + 1, currentPath));
        } else {
          nodes.push({
            key,
            value: item,
            type: getValueType(item),
            isExpanded: false,
            level,
            path: currentPath
          });
        }
      });
    } else if (typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = [...parentPath, key];
        if (typeof value === 'object' && value !== null) {
          nodes.push({
            key,
            value,
            type: getValueType(value),
            isExpanded: level < 2,
            level,
            path: currentPath
          });
          nodes.push(...buildJsonTree(value, level + 1, currentPath));
        } else {
          nodes.push({
            key,
            value,
            type: getValueType(value),
            isExpanded: false,
            level,
            path: currentPath
          });
        }
      });
    }

    return nodes;
  }, []);

  const formatJson = useCallback(() => {
    if (!jsonInput.trim()) {
      setError('请输入JSON内容');
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      const formatted = JSON.stringify(parsed, null, 2);
      setFormattedJson(formatted);
      setParsedData(parsed);
      setJsonTree(buildJsonTree(parsed));
      setError('');
      setSelectedNode(null);
    } catch (err) {
      setError('JSON格式错误：' + (err as Error).message);
      setFormattedJson('');
      setParsedData(null);
      setJsonTree([]);
      setSelectedNode(null);
    }
  }, [jsonInput, buildJsonTree]);

  useEffect(() => {
    if (parsedData !== null) {
      const formatted = JSON.stringify(parsedData, null, 2);
      setFormattedJson(formatted);
      setJsonTree(buildJsonTree(parsedData));
    }
  }, [parsedData, buildJsonTree]);

  const toggleExpanded = useCallback((index: number) => {
    setJsonTree(prev => {
      const newTree = [...prev];
      const node = newTree[index];
      node.isExpanded = !node.isExpanded;
      return newTree;
    });
  }, []);

  const expandAll = useCallback(() => {
    setJsonTree(prev => prev.map(node => ({ ...node, isExpanded: true })));
  }, []);

  const collapseAll = useCallback(() => {
    setJsonTree(prev => prev.map(node => ({ ...node, isExpanded: false })));
  }, []);

  const updateValueByPath = (obj: any, path: string[], newValue: any): any => {
    if (path.length === 0) return newValue;
    
    const result = Array.isArray(obj) ? [...obj] : { ...obj };
    const [currentKey, ...restPath] = path;
    
    if (restPath.length === 0) {
      result[currentKey] = newValue;
    } else {
      result[currentKey] = updateValueByPath(result[currentKey], restPath, newValue);
    }
    
    return result;
  };

  const startEdit = useCallback((node: JsonNode) => {
    const pathKey = node.path.join('.');
    setEditingNode(pathKey);
    setEditValue(JSON.stringify(node.value));
  }, []);

  const saveEdit = useCallback((node: JsonNode) => {
    try {
      const newValue = JSON.parse(editValue);
      const newData = updateValueByPath(parsedData, node.path, newValue);
      setParsedData(newData);
      setEditingNode(null);
      setEditValue('');
    } catch (err) {
      alert('输入的值不是有效的JSON格式');
    }
  }, [editValue, parsedData]);

  const cancelEdit = useCallback(() => {
    setEditingNode(null);
    setEditValue('');
  }, []);

  const startFormattedEdit = useCallback(() => {
    setIsEditingFormatted(true);
    setFormattedEditValue(formattedJson);
  }, [formattedJson]);

  const saveFormattedEdit = useCallback(() => {
    try {
      const parsed = JSON.parse(formattedEditValue);
      setParsedData(parsed);
      setIsEditingFormatted(false);
      setFormattedEditValue('');
      setError('');
    } catch (err) {
      setError('JSON格式错误：' + (err as Error).message);
    }
  }, [formattedEditValue]);

  const cancelFormattedEdit = useCallback(() => {
    setIsEditingFormatted(false);
    setFormattedEditValue('');
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!formattedJson) return;
    
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, [formattedJson]);

  const downloadJson = useCallback(() => {
    if (!formattedJson) return;
    
    const blob = new Blob([formattedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [formattedJson]);

  const clearInput = useCallback(() => {
    setJsonInput('');
    setFormattedJson('');
    setParsedData(null);
    setJsonTree([]);
    setError('');
    setEditingNode(null);
    setEditValue('');
    setIsEditingFormatted(false);
    setFormattedEditValue('');
    setSelectedNode(null);
  }, []);

  const selectNode = useCallback((node: JsonNode) => {
    setSelectedNode(node);
  }, []);

  const getValueDisplay = (node: JsonNode) => {
    const { value, type, path } = node;
    const pathKey = path.join('.');
    const isEditing = editingNode === pathKey;

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm font-mono"
            autoFocus
          />
          <button
            onClick={() => saveEdit(node)}
            className="p-1 text-green-600 hover:bg-green-100 rounded"
          >
            <Check size={14} />
          </button>
          <button
            onClick={cancelEdit}
            className="p-1 text-red-600 hover:bg-red-100 rounded"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    const canEdit = type !== 'object' && type !== 'array';

    return (
      <div className="flex items-center space-x-2">
        {type === 'null' && <span className="text-gray-500 font-medium">null</span>}
        {type === 'string' && <span className="text-green-600 font-medium">"{value}"</span>}
        {type === 'number' && <span className="text-blue-600 font-medium">{value}</span>}
        {type === 'boolean' && <span className="text-purple-600 font-medium">{value.toString()}</span>}
        {type === 'array' && <span className="text-orange-600 font-medium">[{value.length} items]</span>}
        {type === 'object' && <span className="text-red-600 font-medium">{`{${Object.keys(value).length} keys}`}</span>}
        {canEdit && (
          <button
            onClick={() => startEdit(node)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit3 size={12} />
          </button>
        )}
      </div>
    );
  };

  const renderJsonTree = () => {
    const visibleNodes: { node: JsonNode; originalIndex: number }[] = [];
    
    for (let i = 0; i < jsonTree.length; i++) {
      const node = jsonTree[i];
      
      if (node.level === 0) {
        visibleNodes.push({ node, originalIndex: i });
      } else {
        let isVisible = true;
        let currentLevel = node.level;
        
        for (let j = i - 1; j >= 0 && currentLevel > 0; j--) {
          const potentialParent = jsonTree[j];
          if (potentialParent.level === currentLevel - 1) {
            if (!potentialParent.isExpanded) {
              isVisible = false;
              break;
            }
            currentLevel = potentialParent.level;
          }
        }
        
        if (isVisible) {
          visibleNodes.push({ node, originalIndex: i });
        }
      }
    }

    return visibleNodes.map(({ node, originalIndex }) => {
      const hasChildren = node.type === 'object' || node.type === 'array';
      const indent = node.level * 20;
      const isSelected = selectedNode?.path.join('.') === node.path.join('.');

      return (
        <div
          key={originalIndex}
          className={`group flex items-center py-1.5 px-2 hover:bg-blue-50 rounded cursor-pointer transition-colors duration-200 ${
            isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => selectNode(node)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(originalIndex);
              }}
              className="flex items-center justify-center w-4 h-4 mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors duration-200"
            >
              {node.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <div className="w-4 h-4 mr-2" />
          )}
          <span className="text-blue-700 font-medium mr-2 text-sm">{node.key}:</span>
          <div className="text-sm">{getValueDisplay(node)}</div>
        </div>
      );
    });
  };

  const renderPropertiesPanel = () => {
    if (!selectedNode) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <Settings size={48} className="mx-auto mb-4 opacity-50" />
            <p>选择一个节点查看属性</p>
          </div>
        </div>
      );
    }

    const { key, value, type, path } = selectedNode;

    return (
      <div className="p-4 space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">节点属性</h3>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">键名</label>
            <div className="p-2 bg-gray-50 rounded border text-sm font-mono">{key}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">路径</label>
            <div className="p-2 bg-gray-50 rounded border text-sm font-mono">
              {path.length > 0 ? path.join(' → ') : 'root'}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
            <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              type === 'string' ? 'bg-green-100 text-green-800' :
              type === 'number' ? 'bg-blue-100 text-blue-800' :
              type === 'boolean' ? 'bg-purple-100 text-purple-800' :
              type === 'array' ? 'bg-orange-100 text-orange-800' :
              type === 'object' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {type.toUpperCase()}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">值</label>
            <div className="p-3 bg-gray-50 rounded border max-h-40 overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {type === 'object' || type === 'array' 
                  ? JSON.stringify(value, null, 2)
                  : JSON.stringify(value)
                }
              </pre>
            </div>
          </div>
          
          {(type === 'object' || type === 'array') && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {type === 'array' ? '数组长度' : '对象键数'}
              </label>
              <div className="p-2 bg-gray-50 rounded border text-sm font-mono">
                {type === 'array' ? value.length : Object.keys(value).length}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-3">
          <Code className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-800">JSON 格式化工具</h1>
        </div>
      </div>

      {/* Main Content - Four Column Layout */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Column 1: Input Area */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center mb-3">
              <FileText className="mr-2 text-blue-600" size={18} />
              输入 JSON
            </h2>
            <div className="flex space-x-2 mb-3">
              <button
                onClick={formatJson}
                className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 text-sm"
              >
                <Code size={14} className="mr-1" />
                格式化
              </button>
              <button
                onClick={clearInput}
                className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors duration-200 text-sm"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-4">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="在这里粘贴您的 JSON 数据..."
              className="w-full h-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
            />
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Tree Structure */}
        <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">树状结构</h2>
              <div className="flex space-x-2">
                <button
                  onClick={expandAll}
                  className="flex items-center px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors duration-200 text-sm"
                >
                  <Expand size={14} className="mr-1" />
                  展开
                </button>
                <button
                  onClick={collapseAll}
                  className="flex items-center px-3 py-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors duration-200 text-sm"
                >
                  <Minimize size={14} className="mr-1" />
                  收缩
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {jsonTree.length > 0 ? (
              <div className="space-y-0.5">
                {renderJsonTree()}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>请先输入并格式化 JSON 数据</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Formatted Code */}
        <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">格式化代码</h2>
              <div className="flex space-x-2">
                {!isEditingFormatted ? (
                  <>
                    <button
                      onClick={startFormattedEdit}
                      className="flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors duration-200 text-sm"
                    >
                      <Edit3 size={14} className="mr-1" />
                      编辑
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center px-3 py-1.5 rounded transition-colors duration-200 text-sm ${
                        copySuccess
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Copy size={14} className="mr-1" />
                      {copySuccess ? '已复制' : '复制'}
                    </button>
                    <button
                      onClick={downloadJson}
                      className="flex items-center px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors duration-200 text-sm"
                    >
                      <Download size={14} className="mr-1" />
                      下载
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveFormattedEdit}
                      className="flex items-center px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors duration-200 text-sm"
                    >
                      <Check size={14} className="mr-1" />
                      保存
                    </button>
                    <button
                      onClick={cancelFormattedEdit}
                      className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors duration-200 text-sm"
                    >
                      <X size={14} className="mr-1" />
                      取消
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {formattedJson ? (
              <div className="h-full">
                {isEditingFormatted ? (
                  <textarea
                    value={formattedEditValue}
                    onChange={(e) => setFormattedEditValue(e.target.value)}
                    className="w-full h-full p-4 bg-gray-900 text-green-400 font-mono text-sm border-none outline-none resize-none"
                    autoFocus
                  />
                ) : (
                  <pre className="p-4 bg-gray-900 text-green-400 font-mono text-sm h-full overflow-auto whitespace-pre-wrap">
                    {formattedJson}
                  </pre>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>格式化后的代码将显示在这里</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Properties Panel */}
        <div className="w-80 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <Settings className="mr-2 text-blue-600" size={18} />
              属性面板
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderPropertiesPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;