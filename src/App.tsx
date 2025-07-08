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
  const [nodeLineMap, setNodeLineMap] = useState<Map<string, number>>(new Map());
  const [isScrollSyncing, setIsScrollSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const treeItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  const calculateNodeLineNumbers = useCallback((data: any) => {
    if (!data) return new Map();
    
    const lines = JSON.stringify(data, null, 2).split('\n');
    const lineMap = new Map<string, number>();
    
    const processNode = (obj: any, path: string[] = [], currentLine: number = 0): number => {
      if (obj === null || typeof obj !== 'object') {
        const pathKey = path.join('.');
        lineMap.set(pathKey, currentLine);
        return currentLine;
      }
      
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          const newPath = [...path, index.toString()];
          const pathKey = newPath.join('.');
          
          // 找到这个数组项在格式化JSON中的行号
          let lineFound = false;
          for (let i = currentLine; i < lines.length; i++) {
            const line = lines[i];
            const indent = '  '.repeat(path.length + 1);
            
            if (typeof item === 'object' && item !== null) {
              if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
                lineMap.set(pathKey, i);
                currentLine = processNode(item, newPath, i + 1);
                lineFound = true;
                break;
              }
            } else {
              const valueStr = JSON.stringify(item);
              if (line.includes(valueStr) && line.startsWith(indent)) {
                lineMap.set(pathKey, i);
                currentLine = i + 1;
                lineFound = true;
                break;
              }
            }
          }
          if (!lineFound) currentLine++;
        });
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          const newPath = [...path, key];
          const pathKey = newPath.join('.');
          
          // 找到这个对象属性在格式化JSON中的行号
          let lineFound = false;
          for (let i = currentLine; i < lines.length; i++) {
            const line = lines[i];
            const indent = '  '.repeat(path.length + 1);
            
            if (line.includes(`"${key}":`) && line.startsWith(indent)) {
              lineMap.set(pathKey, i);
              if (typeof value === 'object' && value !== null) {
                currentLine = processNode(value, newPath, i + 1);
              } else {
                currentLine = i + 1;
              }
              lineFound = true;
              break;
            }
          }
          if (!lineFound) currentLine++;
        });
      }
      
      return currentLine;
    };
    
    processNode(data);
    return lineMap;
  }, []);

  // 节流函数
  const throttle = useCallback((func: Function, delay: number) => {
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastSyncTime >= delay) {
        setLastSyncTime(now);
        func(...args);
      }
    };
  }, [lastSyncTime]);

  // 平滑滚动函数
  const smoothScrollTo = useCallback((element: HTMLElement, targetScrollTop: number, duration: number = 150) => {
    const startScrollTop = element.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const startTime = performance.now();

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      element.scrollTop = startScrollTop + distance * easeOutCubic;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateScroll);
      } else {
        setIsScrollSyncing(false);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animateScroll);
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
      setNodeLineMap(calculateNodeLineNumbers(parsed));
      setError('');
      setSelectedNode(null);
    } catch (err) {
      setError('JSON格式错误：' + (err as Error).message);
      setFormattedJson('');
      setParsedData(null);
      setJsonTree([]);
      setSelectedNode(null);
    }
  }, [jsonInput, buildJsonTree, calculateNodeLineNumbers]);

  useEffect(() => {
    if (parsedData !== null) {
      const formatted = JSON.stringify(parsedData, null, 2);
      setFormattedJson(formatted);
      setJsonTree(buildJsonTree(parsedData));
      setNodeLineMap(calculateNodeLineNumbers(parsedData));
    }
  }, [parsedData, buildJsonTree, calculateNodeLineNumbers]);

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
    
    // 同步滚动到格式化代码对应位置
    if (!isScrollSyncing && codeScrollRef.current) {
      const pathKey = node.path.join('.');
      const lineNumber = nodeLineMap.get(pathKey);
      
      if (lineNumber !== undefined) {
        setIsScrollSyncing(true);
        const lineHeight = 16;
        const scrollTop = lineNumber * lineHeight;
        smoothScrollTo(codeScrollRef.current, scrollTop);
      }
    }
  }, [nodeLineMap, isScrollSyncing, smoothScrollTo]);

  const handleTreeScrollInternal = useCallback(() => {
    if (isScrollSyncing || !treeScrollRef.current || !codeScrollRef.current) return;
    
    const treeContainer = treeScrollRef.current;
    const scrollTop = treeContainer.scrollTop;
    const containerHeight = treeContainer.clientHeight;
    const middleY = scrollTop + containerHeight / 2;
    
    // 优化：只检查可见区域附近的节点
    let closestNode: JsonNode | null = null;
    let closestDistance = Infinity;
    
    // 使用更高效的方式查找可见节点
    const visibleElements: Array<{ element: HTMLDivElement; pathKey: string; node: JsonNode }> = [];
    
    treeItemRefs.current.forEach((element, pathKey) => {
      const elementTop = element.offsetTop;
      const elementBottom = elementTop + element.offsetHeight;
      
      // 只处理可见区域附近的元素
      if (elementBottom >= scrollTop - 100 && elementTop <= scrollTop + containerHeight + 100) {
        const node = jsonTree.find(n => n.path.join('.') === pathKey);
        if (node) {
          visibleElements.push({ element, pathKey, node });
        }
      }
    });
    
    // 在可见元素中找到最接近中间的
    visibleElements.forEach(({ element, node }) => {
      const elementMiddle = element.offsetTop + element.offsetHeight / 2;
      const distance = Math.abs(elementMiddle - middleY);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNode = node;
      }
    });
    
    if (closestNode && codeScrollRef.current) {
      const pathKey = closestNode.path.join('.');
      const lineNumber = nodeLineMap.get(pathKey);
      
      if (lineNumber !== undefined) {
        setIsScrollSyncing(true);
        const lineHeight = 16;
        const scrollTop = lineNumber * lineHeight;
        smoothScrollTo(codeScrollRef.current, scrollTop, 100);
      }
    }
  }, [jsonTree, nodeLineMap, isScrollSyncing, smoothScrollTo]);

  const handleCodeScrollInternal = useCallback(() => {
    if (isScrollSyncing || !codeScrollRef.current || !treeScrollRef.current) return;
    
    const codeContainer = codeScrollRef.current;
    const scrollTop = codeContainer.scrollTop;
    const lineHeight = 16;
    const currentLine = Math.floor(scrollTop / lineHeight);
    
    // 优化：使用二分查找或更高效的方式找到最接近的节点
    let closestNode: JsonNode | null = null;
    let closestDistance = Infinity;
    
    // 创建一个按行号排序的数组来优化查找
    const sortedNodes = Array.from(nodeLineMap.entries())
      .map(([pathKey, lineNumber]) => ({
        pathKey,
        lineNumber,
        node: jsonTree.find(n => n.path.join('.') === pathKey)
      }))
      .filter(item => item.node)
      .sort((a, b) => a.lineNumber - b.lineNumber);
    
    // 找到最接近当前行的节点
    for (const item of sortedNodes) {
      const distance = Math.abs(item.lineNumber - currentLine);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNode = item.node!;
      } else if (distance > closestDistance) {
        // 由于已排序，距离开始增加时可以停止搜索
        break;
      }
    }
    
    if (closestNode && treeScrollRef.current) {
      const pathKey = closestNode.path.join('.');
      const element = treeItemRefs.current.get(pathKey);
      
      if (element) {
        setIsScrollSyncing(true);
        const treeContainer = treeScrollRef.current;
        const elementTop = element.offsetTop;
        const containerHeight = treeContainer.clientHeight;
        const scrollTop = Math.max(0, elementTop - containerHeight / 2);
        
        smoothScrollTo(treeContainer, scrollTop, 100);
      }
    }
  }, [jsonTree, nodeLineMap, isScrollSyncing, smoothScrollTo]);

  // 使用节流的滚动处理函数
  const handleTreeScroll = useCallback(
    throttle(handleTreeScrollInternal, 16), // 约60fps
    [handleTreeScrollInternal, throttle]
  );

  const handleCodeScroll = useCallback(
    throttle(handleCodeScrollInternal, 16), // 约60fps
    [handleCodeScrollInternal, throttle]
  );

  // 清理函数
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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
            className="px-1 py-0.5 border border-gray-300 rounded text-xs font-mono flex-1"
            autoFocus
          />
          <button
            onClick={() => saveEdit(node)}
            className="p-0.5 text-green-600 hover:bg-green-100 rounded"
          >
            <Check size={12} />
          </button>
          <button
            onClick={cancelEdit}
            className="p-0.5 text-red-600 hover:bg-red-100 rounded"
          >
            <X size={12} />
          </button>
        </div>
      );
    }

    const canEdit = type !== 'object' && type !== 'array';

    return (
      <div className="flex items-center space-x-2">
        {type === 'null' && <span className="text-gray-500 font-medium">null</span>}
        {type === 'string' && <span className="text-green-600 font-medium truncate" style={{ maxWidth: '150px' }}>"{value}"</span>}
        {type === 'number' && <span className="text-blue-600 font-medium">{value}</span>}
        {type === 'boolean' && <span className="text-purple-600 font-medium">{value.toString()}</span>}
        {type === 'array' && <span className="text-orange-600 font-medium">[{value.length}]</span>}
        {type === 'object' && <span className="text-red-600 font-medium">{`{${Object.keys(value).length}}`}</span>}
        {canEdit && (
          <button
            onClick={() => startEdit(node)}
            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit3 size={10} />
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
          ref={(el) => {
            const pathKey = node.path.join('.');
            if (el) {
              treeItemRefs.current.set(pathKey, el);
            } else {
              treeItemRefs.current.delete(pathKey);
            }
          }}
          className={`group flex items-center py-1.5 px-2 hover:bg-blue-50 rounded cursor-pointer transition-colors duration-200 ${
            isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${indent + 4}px` }}
          onClick={() => selectNode(node)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(originalIndex);
              }}
              className="flex items-center justify-center w-4 h-4 mr-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors duration-200 flex-shrink-0"
            >
              {node.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <div className="w-4 h-4 mr-1 flex-shrink-0" />
          )}
          <span className="text-blue-700 font-medium mr-1 text-xs truncate flex-shrink-0" style={{ maxWidth: '120px' }}>{node.key}:</span>
          <div className="text-xs flex-1 min-w-0">{getValueDisplay(node)}</div>
        </div>
      );
    });
  };

  const renderPropertiesPanel = () => {
    if (!selectedNode) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <Settings size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">选择节点查看属性</p>
          </div>
        </div>
      );
    }

    const { key, value, type, path } = selectedNode;

    return (
      <div className="p-3 space-y-3">
        <div className="border-b border-gray-200 pb-2">
          <h3 className="text-base font-semibold text-gray-800 mb-1">节点属性</h3>
        </div>
        
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">键名</label>
            <div className="p-2 bg-gray-50 rounded border text-xs font-mono break-all">{key}</div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">路径</label>
            <div className="p-2 bg-gray-50 rounded border text-xs font-mono break-all">
              {path.length > 0 ? path.join(' → ') : 'root'}
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">类型</label>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">值</label>
            <div className="p-2 bg-gray-50 rounded border max-h-32 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {type === 'object' || type === 'array' 
                  ? JSON.stringify(value, null, 2)
                  : JSON.stringify(value)
                }
              </pre>
            </div>
          </div>
          
          {(type === 'object' || type === 'array') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {type === 'array' ? '数组长度' : '对象键数'}
              </label>
              <div className="p-2 bg-gray-50 rounded border text-xs font-mono">
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
        <div className="flex items-center space-x-2">
          <Code className="text-blue-600" size={28} />
          <h1 className="text-xl font-bold text-gray-800 truncate">JSON 格式化工具</h1>
        </div>
      </div>

      {/* Main Content - Four Column Layout */}
      <div className="flex h-[calc(100vh-72px)]">
        {/* Column 1: Input Area */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800 flex items-center mb-2 truncate">
              <FileText className="mr-2 text-blue-600" size={18} />
              输入 JSON
            </h2>
            <div className="flex space-x-1 mb-2">
              <button
                onClick={formatJson}
                className="flex-1 flex items-center justify-center px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 text-xs"
              >
                <Code size={12} className="mr-1" />
                格式化
              </button>
              <button
                onClick={clearInput}
                className="flex items-center justify-center px-2 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors duration-200 text-xs"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-3">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="在这里粘贴您的 JSON 数据..."
              className="w-full h-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-xs"
            />
            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Tree Structure */}
        <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 truncate">树状结构</h2>
              <div className="flex space-x-1">
                <button
                  onClick={expandAll}
                  className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors duration-200 text-xs"
                >
                  <Expand size={12} className="mr-1" />
                  展开
                </button>
                <button
                  onClick={collapseAll}
                  className="flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors duration-200 text-xs"
                >
                  <Minimize size={12} className="mr-1" />
                  收缩
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {jsonTree.length > 0 ? (
              <div 
                ref={treeScrollRef}
                className="space-y-0 h-full overflow-y-auto"
                onScroll={handleTreeScroll}
                style={{ scrollBehavior: 'auto' }}
              >
                {renderJsonTree()}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                <p>请先输入并格式化 JSON</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Formatted Code */}
        <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 truncate">格式化代码</h2>
              <div className="flex space-x-1">
                {!isEditingFormatted ? (
                  <>
                    <button
                      onClick={startFormattedEdit}
                      className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors duration-200 text-xs"
                    >
                      <Edit3 size={12} className="mr-1" />
                      编辑
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center px-2 py-1 rounded transition-colors duration-200 text-xs ${
                        copySuccess
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Copy size={12} className="mr-1" />
                      {copySuccess ? '已复制' : '复制'}
                    </button>
                    <button
                      onClick={downloadJson}
                      className="flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors duration-200 text-xs"
                    >
                      <Download size={12} className="mr-1" />
                      下载
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveFormattedEdit}
                      className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors duration-200 text-xs"
                    >
                      <Check size={12} className="mr-1" />
                      保存
                    </button>
                    <button
                      onClick={cancelFormattedEdit}
                      className="flex items-center px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors duration-200 text-xs"
                    >
                      <X size={12} className="mr-1" />
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
                    className="w-full h-full p-3 bg-gray-900 text-green-400 font-mono text-xs border-none outline-none resize-none"
                    autoFocus
                  />
                ) : (
                  <pre 
                    ref={codeScrollRef}
                    className="p-3 bg-gray-900 text-green-400 font-mono text-xs h-full overflow-auto whitespace-pre-wrap"
                    onScroll={handleCodeScroll}
                    style={{ lineHeight: '16px', scrollBehavior: 'auto' }}
                  >
                    {formattedJson}
                  </pre>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                <p>格式化后的代码显示在这里</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Properties Panel */}
        <div className="w-72 bg-white flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800 flex items-center truncate">
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