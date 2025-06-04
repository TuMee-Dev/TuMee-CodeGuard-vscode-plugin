// context-payload-examples.js

// Minimal payload for testing
const minimalPayload = {
  "contextUsage": {
    "current": 76000,
    "maximum": 100000,
    "percentage": 76,
    "unit": "tokens"
  },
  "settings": {
    "autoCleanupThreshold": 40,
    "autoCleanupEnabled": true,
    "sortBy": "temporal",
    "groupByTime": true
  },
  "chunks": [
    {
      "id": "chunk_001",
      "type": "conversation",
      "title": "Initial Setup",
      "description": "Configuration discussion",
      "tokens": 25000,
      "timestamp": "2024-12-03T10:00:00Z",
      "metadata": {
        "messageCount": 20,
        "source": "chat"
      },
      "actions": {
        "canDelete": true,
        "canSummarize": true,
        "canExtract": false,
        "canArchive": true
      },
      "visual": {
        "icon": "💬",
        "color": "#3794ff"
      }
    },
    {
      "id": "chunk_002",
      "type": "file",
      "title": "data.csv",
      "description": "Dataset upload",
      "tokens": 51000,
      "timestamp": "2024-12-03T11:00:00Z",
      "metadata": {
        "fileName": "data.csv",
        "fileSize": "5.2 MB",
        "source": "upload"
      },
      "actions": {
        "canDelete": true,
        "canSummarize": false,
        "canExtract": true,
        "canArchive": false
      },
      "visual": {
        "icon": "📑",
        "color": "#e05252"
      }
    }
  ],
  "temporalGroups": [],
  "statistics": {
    "totalChunks": 2,
    "byType": {
      "conversation": { "count": 1, "tokens": 25000 },
      "file": { "count": 1, "tokens": 51000 }
    },
    "oldestChunk": "2024-12-03T10:00:00Z",
    "newestChunk": "2024-12-03T11:00:00Z",
    "averageChunkSize": 38000
  },
  "suggestions": [],
  "version": "1.0",
  "timestamp": new Date().toISOString()
};

// Example: Empty state
const emptyPayload = {
  "contextUsage": {
    "current": 0,
    "maximum": 100000,
    "percentage": 0,
    "unit": "tokens"
  },
  "settings": {
    "autoCleanupThreshold": 40,
    "autoCleanupEnabled": true,
    "sortBy": "temporal",
    "groupByTime": true
  },
  "chunks": [],
  "temporalGroups": [],
  "statistics": {
    "totalChunks": 0,
    "byType": {},
    "oldestChunk": null,
    "newestChunk": null,
    "averageChunkSize": 0
  },
  "suggestions": [],
  "version": "1.0",
  "timestamp": new Date().toISOString()
};

// Example: Near capacity with suggestions
const nearCapacityPayload = {
  "contextUsage": {
    "current": 95000,
    "maximum": 100000,
    "percentage": 95,
    "unit": "tokens"
  },
  "settings": {
    "autoCleanupThreshold": 40,
    "autoCleanupEnabled": true,
    "sortBy": "temporal",
    "groupByTime": true
  },
  "chunks": [
    // ... chunks here
  ],
  "suggestions": [
    {
      "id": "sug_001",
      "type": "warning",
      "priority": "high",
      "message": "Context is at 95% capacity. Consider cleaning up old conversations.",
      "affectedChunks": [],
      "potentialSavings": 0
    },
    {
      "id": "sug_002",
      "type": "cleanup",
      "priority": "high",
      "message": "Large file 'dataset.csv' can be replaced with extracted insights",
      "affectedChunks": ["chunk_003"],
      "potentialSavings": 40000
    }
  ],
  "version": "1.0",
  "timestamp": new Date().toISOString()
};

// Helper function to generate mock data
function generateMockPayload(chunkCount = 10, usagePercentage = 50) {
  const maxTokens = 100000;
  const currentTokens = Math.floor(maxTokens * (usagePercentage / 100));
  const avgTokensPerChunk = Math.floor(currentTokens / chunkCount);
  
  const chunkTypes = ['conversation', 'file', 'search', 'analysis', 'code'];
  const chunks = [];
  
  for (let i = 0; i < chunkCount; i++) {
    const type = chunkTypes[i % chunkTypes.length];
    const variance = Math.random() * 0.4 - 0.2; // ±20% variance
    const tokens = Math.floor(avgTokensPerChunk * (1 + variance));
    
    chunks.push({
      id: `chunk_${String(i + 1).padStart(3, '0')}`,
      type: type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}`,
      description: `Auto-generated ${type} chunk`,
      tokens: tokens,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(), // 1 hour apart
      metadata: {
        source: type === 'file' ? 'upload' : 'chat',
        messageCount: type === 'conversation' ? Math.floor(Math.random() * 50) + 10 : undefined
      },
      actions: {
        canDelete: true,
        canSummarize: type === 'conversation',
        canExtract: type === 'file',
        canArchive: type !== 'file'
      },
      visual: {
        icon: getIconForType(type),
        color: getColorForType(type)
      }
    });
  }
  
  return {
    contextUsage: {
      current: currentTokens,
      maximum: maxTokens,
      percentage: usagePercentage,
      unit: "tokens"
    },
    settings: {
      autoCleanupThreshold: 40,
      autoCleanupEnabled: true,
      sortBy: "temporal",
      groupByTime: true
    },
    chunks: chunks,
    temporalGroups: groupChunksByTime(chunks),
    statistics: calculateStatistics(chunks),
    suggestions: generateSuggestions(chunks, usagePercentage),
    version: "1.0",
    timestamp: new Date().toISOString()
  };
}

function getIconForType(type) {
  const icons = {
    'conversation': '💬',
    'file': '📑',
    'search': '🔍',
    'analysis': '📊',
    'code': '🎨'
  };
  return icons[type] || '📄';
}

function getColorForType(type) {
  const colors = {
    'conversation': '#3794ff',
    'file': '#e05252',
    'search': '#dcdcaa',
    'analysis': '#4ec9b0',
    'code': '#c586c0'
  };
  return colors[type] || '#cccccc';
}

function groupChunksByTime(chunks) {
  // Simplified temporal grouping
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const groups = {
    today: { label: "Today", chunks: [], tokens: 0 },
    yesterday: { label: "Yesterday", chunks: [], tokens: 0 },
    older: { label: "Older", chunks: [], tokens: 0 }
  };
  
  chunks.forEach(chunk => {
    const chunkDate = new Date(chunk.timestamp);
    if (chunkDate >= today) {
      groups.today.chunks.push(chunk.id);
      groups.today.tokens += chunk.tokens;
    } else if (chunkDate >= yesterday) {
      groups.yesterday.chunks.push(chunk.id);
      groups.yesterday.tokens += chunk.tokens;
    } else {
      groups.older.chunks.push(chunk.id);
      groups.older.tokens += chunk.tokens;
    }
  });
  
  return Object.entries(groups)
    .filter(([_, group]) => group.chunks.length > 0)
    .map(([id, group]) => ({
      id,
      label: group.label,
      chunkIds: group.chunks,
      totalTokens: group.tokens
    }));
}

function calculateStatistics(chunks) {
  const byType = {};
  chunks.forEach(chunk => {
    if (!byType[chunk.type]) {
      byType[chunk.type] = { count: 0, tokens: 0 };
    }
    byType[chunk.type].count++;
    byType[chunk.type].tokens += chunk.tokens;
  });
  
  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  
  return {
    totalChunks: chunks.length,
    byType,
    oldestChunk: chunks.length > 0 ? chunks[chunks.length - 1].timestamp : null,
    newestChunk: chunks.length > 0 ? chunks[0].timestamp : null,
    averageChunkSize: chunks.length > 0 ? Math.floor(totalTokens / chunks.length) : 0
  };
}

function generateSuggestions(chunks, usagePercentage) {
  const suggestions = [];
  
  if (usagePercentage > 90) {
    suggestions.push({
      id: "sug_high_usage",
      type: "warning",
      priority: "high",
      message: `Context usage is at ${usagePercentage}%. Immediate cleanup recommended.`,
      affectedChunks: [],
      potentialSavings: 0
    });
  }
  
  // Find large files that could be extracted
  const largeFiles = chunks.filter(c => c.type === 'file' && c.tokens > 20000);
  largeFiles.forEach((file, index) => {
    suggestions.push({
      id: `sug_extract_${index}`,
      type: "cleanup",
      priority: "medium",
      message: `Extract insights from '${file.title}' to save ~80% tokens`,
      affectedChunks: [file.id],
      potentialSavings: Math.floor(file.tokens * 0.8)
    });
  });
  
  // Find old conversations
  const oldConversations = chunks.filter(c => {
    const age = Date.now() - new Date(c.timestamp).getTime();
    return c.type === 'conversation' && age > 7 * 24 * 60 * 60 * 1000; // 7 days
  });
  
  if (oldConversations.length > 0) {
    suggestions.push({
      id: "sug_archive_old",
      type: "archive",
      priority: "low",
      message: `${oldConversations.length} conversations are older than 7 days`,
      affectedChunks: oldConversations.map(c => c.id),
      potentialSavings: oldConversations.reduce((sum, c) => sum + c.tokens, 0)
    });
  }
  
  return suggestions;
}

// Export for use in extension
module.exports = {
  minimalPayload,
  emptyPayload,
  nearCapacityPayload,
  generateMockPayload,
  getIconForType,
  getColorForType
};