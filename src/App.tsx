import React, { useState, useCallback, useEffect } from 'react';
import { Copy, Download, Code, ChevronDown, ChevronRight, FileText, Trash2, Expand, Minimize, Edit3, Check, X } from 'lucide-react';

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
            isExpanded: level < 2, // 自动展开前两层
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
            isExpanded: level < 2, // 自动展开前两层
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
    } catch (err) {
      setError('JSON格式错误：' + (err as Error).message);
      setFormattedJson('');
      setParsedData(null);
      setJsonTree([]);
    }
  }, [jsonInput, buildJsonTree]);

  // 当parsedData改变时，更新formattedJson
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

  // 格式化JSON编辑功能
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
    // 构建可见节点列表
    const visibleNodes: { node: JsonNode; originalIndex: number }[] = [];
    
    for (let i = 0; i < jsonTree.length; i++) {
      const node = jsonTree[i];
      
      if (node.level === 0) {
        // 根节点总是可见
        visibleNodes.push({ node, originalIndex: i });
      } else {
        // 检查是否所有父节点都展开
        let isVisible = true;
        let currentLevel = node.level;
        
        // 从当前位置向前查找父节点
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
      const indent = node.level * 24;

      return (
        <div
          key={originalIndex}
          className="group flex items-center py-1 hover:bg-gray-50 rounded-md transition-colors duration-200"
          style={{ paddingLeft: `${indent}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(originalIndex)}
              className="flex items-center justify-center w-5 h-5 mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors duration-200"
            >
              {node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-5 h-5 mr-2" />
          )}
          <span className="text-blue-700 font-medium mr-2">{node.key}:</span>
          {getValueDisplay(node)}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <div className="flex items-center space-x-3">
              <Code className="text-white" size={32} />
              <h1 className="text-3xl font-bold text-white">JSON 格式化工具</h1>
            </div>
            <p className="text-blue-100 mt-2">将 JSON 字符串转换为可读、可编辑、可折叠的结构</p>
          </div>

          {/* Main Content */}
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Input Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <FileText className="mr-2 text-blue-600" size={20} />
                  输入 JSON 内容
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={clearInput}
                    className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    <Trash2 size={16} className="mr-2" />
                    清空
                  </button>
                  <button
                    onClick={formatJson}
                    className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Code size={16} className="mr-2" />
                    格式化
                  </button>
                </div>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="在这里粘贴您的 JSON 数据..."
                className="w-full h-32 sm:h-40 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              />
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Results Section */}
            {formattedJson && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                {/* Tree View */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">树状结构（可编辑）</h2>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={expandAll}
                        className="flex items-center px-2 sm:px-3 py-1 sm:py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 text-sm"
                      >
                        <Expand size={14} className="mr-1" />
                        全部展开
                      </button>
                      <button
                        onClick={collapseAll}
                        className="flex items-center px-2 sm:px-3 py-1 sm:py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors duration-200 text-sm"
                      >
                        <Minimize size={14} className="mr-1" />
                        全部收缩
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4 h-[500px] sm:h-[600px] lg:h-[700px] overflow-y-auto border border-gray-200 shadow-inner">
                    {renderJsonTree()}
                  </div>
                </div>

                {/* Formatted JSON */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">格式化代码（可编辑）</h2>
                    <div className="flex flex-wrap gap-2">
                      {!isEditingFormatted ? (
                        <>
                          <button
                            onClick={startFormattedEdit}
                            className="flex items-center px-2 sm:px-3 py-1 sm:py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors duration-200 text-sm"
                          >
                            <Edit3 size={14} className="mr-1" />
                            编辑
                          </button>
                          <button
                            onClick={copyToClipboard}
                            className={`flex items-center px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition-colors duration-200 text-sm ${
                              copySuccess
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Copy size={16} className="mr-2" />
                            {copySuccess ? '已复制!' : '复制'}
                          </button>
                          <button
                            onClick={downloadJson}
                            className="flex items-center px-2 sm:px-4 py-1 sm:py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors duration-200 text-sm"
                          >
                            <Download size={14} className="mr-1 sm:mr-2" />
                            下载
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={saveFormattedEdit}
                            className="flex items-center px-2 sm:px-3 py-1 sm:py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 text-sm"
                          >
                            <Check size={14} className="mr-1" />
                            保存
                          </button>
                          <button
                            onClick={cancelFormattedEdit}
                            className="flex items-center px-2 sm:px-3 py-1 sm:py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 text-sm"
                          >
                            <X size={14} className="mr-1" />
                            取消
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 sm:p-4 h-[500px] sm:h-[600px] lg:h-[700px] overflow-auto shadow-inner">
                    {isEditingFormatted ? (
                      <textarea
                        value={formattedEditValue}
                        onChange={(e) => setFormattedEditValue(e.target.value)}
                        className="w-full h-full bg-gray-800 text-green-400 font-mono text-xs sm:text-sm p-2 border-none outline-none resize-none"
                        autoFocus
                      />
                    ) : (
                      <pre className="text-green-400 font-mono text-xs sm:text-sm whitespace-pre-wrap">
                        {formattedJson}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600">
          <p>一个功能强大的 JSON 格式化工具，支持树状结构查看、双向实时编辑、自动折叠和快速复制下载</p>
        </div>
      </div>
    </div>
  );
}

export default App;