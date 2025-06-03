// context-manager-types.ts

export interface ContextPayload {
  contextUsage: ContextUsage;
  settings: ContextSettings;
  chunks: ContextChunk[];
  temporalGroups: TemporalGroup[];
  statistics: ContextStatistics;
  suggestions: ContextSuggestion[];
  version: string;
  timestamp: string;
}

export interface ContextUsage {
  current: number;
  maximum: number;
  percentage: number;
  unit: 'tokens' | 'characters';
}

export interface ContextSettings {
  autoCleanupThreshold: number;
  autoCleanupEnabled: boolean;
  sortBy: 'temporal' | 'type' | 'size';
  groupByTime: boolean;
}

export interface ContextChunk {
  id: string;
  type: ChunkType;
  title: string;
  description: string;
  tokens: number;
  timestamp: string;
  metadata: ChunkMetadata;
  actions: ChunkActions;
  visual: ChunkVisual;
}

export type ChunkType = 'conversation' | 'file' | 'search' | 'analysis' | 'code';

export interface ChunkMetadata {
  // Common fields
  source: 'chat' | 'upload' | 'generation' | 'computation' | 'web_search';
  
  // Conversation-specific
  messageCount?: number;
  participants?: string[];
  tags?: string[];
  codeBlocks?: number;
  
  // File-specific
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  rows?: number;
  columns?: number;
  pageCount?: number;
  extractedInsights?: boolean;
  extracted?: {
    keyPoints: number;
    figures: number;
    tables: number;
  };
  
  // Search-specific
  searchQueries?: string[];
  resultCount?: number;
  sources?: string[];
  domains?: string[];
  
  // Analysis-specific
  analysisType?: string;
  dataPoints?: number;
  charts?: number;
  parentChunk?: string;
  
  // Code-specific
  artifactCount?: number;
  language?: string;
  artifacts?: CodeArtifact[];
}

export interface CodeArtifact {
  id: string;
  title: string;
  lines: number;
}

export interface ChunkActions {
  canDelete: boolean;
  canSummarize: boolean;
  canExtract: boolean;
  canArchive: boolean;
  customActions?: CustomAction[];
}

export interface CustomAction {
  id: string;
  label: string;
  description: string;
}

export interface ChunkVisual {
  icon: string;
  color: string;
}

export interface TemporalGroup {
  id: string;
  label: string;
  dateRange: {
    start: string;
    end: string;
  };
  chunkIds: string[];
  totalTokens: number;
}

export interface ContextStatistics {
  totalChunks: number;
  byType: {
    [key in ChunkType]?: {
      count: number;
      tokens: number;
    };
  };
  oldestChunk: string;
  newestChunk: string;
  averageChunkSize: number;
}

export interface ContextSuggestion {
  id: string;
  type: 'cleanup' | 'archive' | 'optimize' | 'warning';
  priority: 'low' | 'medium' | 'high';
  message: string;
  affectedChunks: string[];
  potentialSavings?: number;
}

// Helper types for actions
export interface ChunkAction {
  chunkId: string;
  action: 'delete' | 'summarize' | 'extract' | 'archive';
  customActionId?: string;
}

export interface BatchAction {
  type: 'deleteGroup' | 'summarizeGroup' | 'archiveOlder';
  groupId?: string;
  chunkIds?: string[];
  parameters?: Record<string, any>;
}

// WebView Messages
export interface WebViewMessage {
  type: string;
  payload: any;
}

export interface DeleteChunkMessage extends WebViewMessage {
  type: 'deleteChunk';
  payload: {
    chunkId: string;
  };
}

export interface UpdateThresholdMessage extends WebViewMessage {
  type: 'updateThreshold';
  payload: {
    value: number;
  };
}

export interface ChangeSortMessage extends WebViewMessage {
  type: 'changeSort';
  payload: {
    sortBy: 'temporal' | 'type' | 'size';
  };
}

export interface ExecuteActionMessage extends WebViewMessage {
  type: 'executeAction';
  payload: {
    chunkId: string;
    actionId: string;
  };
}

// Extension to WebView Messages
export interface UpdateContextMessage extends WebViewMessage {
  type: 'updateContext';
  payload: ContextPayload;
}

export interface ShowSuggestionMessage extends WebViewMessage {
  type: 'showSuggestion';
  payload: ContextSuggestion;
}