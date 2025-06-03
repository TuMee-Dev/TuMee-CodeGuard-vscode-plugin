// webview-script.js
// This runs inside the webview and communicates with the extension

(function() {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // Current state
    let contextData = null;
    
    // Initialize
    function initialize() {
        // Request initial data
        vscode.postMessage({
            type: 'requestData'
        });
        
        // Set up event listeners
        setupEventListeners();
    }
    
    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'updateContext':
                contextData = message.payload;
                render();
                break;
                
            case 'showSuggestion':
                showSuggestion(message.payload);
                break;
                
            case 'error':
                showError(message.payload.message);
                break;
        }
    });
    
    // Render the UI based on current context data
    function render() {
        if (!contextData) return;
        
        // Update gauge
        updateGauge(contextData.contextUsage);
        
        // Update threshold marker
        updateThresholdMarker(contextData.settings.autoCleanupThreshold);
        
        // Render chunks based on current sort
        renderChunks(contextData.chunks, contextData.settings.sortBy);
        
        // Update statistics
        updateStatistics(contextData.statistics);
        
        // Show suggestions if any
        if (contextData.suggestions.length > 0) {
            renderSuggestions(contextData.suggestions);
        }
    }
    
    function updateGauge(usage) {
        const gaugeFill = document.querySelector('.gauge-fill');
        const gaugeText = document.querySelector('.gauge-text');
        const gaugeTokens = document.querySelector('.gauge-tokens');
        
        if (gaugeFill) {
            gaugeFill.style.width = usage.percentage + '%';
            gaugeFill.style.setProperty('--fill-percent', usage.percentage);
            
            // Update color based on percentage
            updateGaugeGradient(usage.percentage);
        }
        
        if (gaugeText) {
            gaugeText.textContent = `${usage.percentage}% USED`;
        }
        
        if (gaugeTokens) {
            const current = Math.round(usage.current / 1000);
            const max = Math.round(usage.maximum / 1000);
            gaugeTokens.textContent = `${current}k / ${max}k`;
        }
        
        // Update minimap if visible
        updateMinimap(usage.percentage);
    }
    
    function updateThresholdMarker(threshold) {
        const marker = document.getElementById('thresholdMarker');
        if (marker) {
            marker.style.left = threshold + '%';
            const tooltip = marker.querySelector('.threshold-tooltip');
            if (tooltip) {
                tooltip.textContent = `Auto-cleanup: ${threshold}%`;
            }
        }
    }
    
    function renderChunks(chunks, sortBy) {
        const container = document.querySelector('.context-chunks');
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Sort chunks based on setting
        const sortedChunks = sortChunks(chunks, sortBy);
        
        // Render based on sort type
        switch (sortBy) {
            case 'temporal':
                renderTemporalView(sortedChunks, container);
                break;
            case 'type':
                renderTypeView(sortedChunks, container);
                break;
            case 'size':
                renderSizeView(sortedChunks, container);
                break;
        }
    }
    
    function renderTemporalView(chunks, container) {
        // Group chunks by time
        const groups = groupChunksByTime(chunks);
        
        groups.forEach(group => {
            // Add divider
            const divider = createDivider(group.label, group.totalTokens);
            container.appendChild(divider);
            
            // Add chunks
            group.chunks.forEach(chunk => {
                const element = createChunkElement(chunk);
                container.appendChild(element);
            });
        });
    }
    
    function renderTypeView(chunks, container) {
        // Group by type
        const typeGroups = {};
        chunks.forEach(chunk => {
            if (!typeGroups[chunk.type]) {
                typeGroups[chunk.type] = {
                    chunks: [],
                    totalTokens: 0
                };
            }
            typeGroups[chunk.type].chunks.push(chunk);
            typeGroups[chunk.type].totalTokens += chunk.tokens;
        });
        
        // Render each type group
        Object.entries(typeGroups).forEach(([type, group]) => {
            const icon = getIconForType(type);
            const label = `${icon} ${type.charAt(0).toUpperCase() + type.slice(1)}s`;
            const divider = createDivider(
                `${label} - ${group.chunks.length} items, ${Math.round(group.totalTokens/1000)}k tokens`,
                0
            );
            container.appendChild(divider);
            
            // Sort by size within type
            group.chunks.sort((a, b) => b.tokens - a.tokens);
            group.chunks.forEach(chunk => {
                const element = createChunkElement(chunk);
                container.appendChild(element);
            });
        });
    }
    
    function renderSizeView(chunks, container) {
        // Sort by size
        const sorted = [...chunks].sort((a, b) => b.tokens - a.tokens);
        
        // Define size groups
        const groups = [
            { label: 'Large (30k+ tokens)', min: 30000 },
            { label: 'Medium (10k-30k tokens)', min: 10000, max: 30000 },
            { label: 'Small (<10k tokens)', max: 10000 }
        ];
        
        groups.forEach(group => {
            const groupChunks = sorted.filter(chunk => {
                if (group.min && chunk.tokens < group.min) return false;
                if (group.max && chunk.tokens >= group.max) return false;
                return true;
            });
            
            if (groupChunks.length > 0) {
                const totalTokens = groupChunks.reduce((sum, c) => sum + c.tokens, 0);
                const divider = createDivider(
                    `${group.label} - ${groupChunks.length} items, ${Math.round(totalTokens/1000)}k total`,
                    0
                );
                container.appendChild(divider);
                
                groupChunks.forEach(chunk => {
                    const element = createChunkElement(chunk);
                    container.appendChild(element);
                });
            }
        });
    }
    
    function createChunkElement(chunk) {
        const div = document.createElement('div');
        div.className = 'chunk-group';
        div.dataset.tokens = chunk.tokens;
        div.dataset.type = chunk.type;
        div.dataset.chunkId = chunk.id;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'chunk-header';
        header.onclick = () => toggleChunk(header);
        
        // Chunk info
        const info = document.createElement('div');
        info.className = 'chunk-info';
        
        const title = document.createElement('div');
        title.className = 'chunk-title';
        title.innerHTML = `
            <span class="chunk-type-icon icon-${chunk.type}"></span>
            ${chunk.title}
        `;
        
        const meta = document.createElement('div');
        meta.className = 'chunk-meta';
        meta.textContent = formatChunkMeta(chunk);
        
        info.appendChild(title);
        info.appendChild(meta);
        
        // Size
        const size = document.createElement('div');
        size.className = 'chunk-size';
        size.textContent = Math.round(chunk.tokens / 1000) + 'k';
        
        header.appendChild(info);
        header.appendChild(size);
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'chunk-actions';
        actions.style.display = 'none';
        
        // Add action buttons
        if (chunk.actions.canSummarize) {
            actions.appendChild(createActionButton('Summarize', () => {
                executeAction(chunk.id, 'summarize');
            }));
        }
        
        if (chunk.actions.canExtract) {
            actions.appendChild(createActionButton('Extract Key Points', () => {
                executeAction(chunk.id, 'extractKeyPoints');
            }));
        }
        
        if (chunk.actions.customActions) {
            chunk.actions.customActions.forEach(action => {
                actions.appendChild(createActionButton(action.label, () => {
                    executeAction(chunk.id, action.id);
                }));
            });
        }
        
        if (chunk.actions.canDelete) {
            actions.appendChild(createActionButton('Delete', () => {
                deleteChunk(chunk.id);
            }, true));
        }
        
        div.appendChild(header);
        div.appendChild(actions);
        
        return div;
    }
    
    function createDivider(label, tokens) {
        const div = document.createElement('div');
        div.className = 'temporal-divider';
        div.innerHTML = `<span>${label}</span>`;
        return div;
    }
    
    function createActionButton(label, onClick, isDanger = false) {
        const button = document.createElement('button');
        button.className = 'action-button' + (isDanger ? ' danger' : '');
        button.textContent = label;
        button.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };
        return button;
    }
    
    function formatChunkMeta(chunk) {
        const icon = chunk.visual.icon;
        const time = formatTime(chunk.timestamp);
        
        switch (chunk.type) {
            case 'conversation':
                return `${icon} ${chunk.metadata.messageCount || 0} msgs • ${time}`;
            case 'file':
                return `${icon} ${chunk.metadata.fileSize || 'Unknown size'} • ${time}`;
            case 'search':
                return `${icon} ${chunk.metadata.resultCount || 0} results • ${time}`;
            case 'analysis':
                return `${icon} ${chunk.metadata.dataPoints || 0} data points • ${time}`;
            case 'code':
                return `${icon} ${chunk.metadata.artifactCount || 0} artifacts • ${time}`;
            default:
                return `${icon} ${time}`;
        }
    }
    
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Today
        if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        
        // Yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate()) {
            return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        
        // This week
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }
        
        // Older
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    // Actions
    function deleteChunk(chunkId) {
        vscode.postMessage({
            type: 'deleteChunk',
            payload: { chunkId }
        });
    }
    
    function executeAction(chunkId, actionId) {
        vscode.postMessage({
            type: 'executeAction',
            payload: { chunkId, actionId }
        });
    }
    
    function updateThreshold(value) {
        vscode.postMessage({
            type: 'updateThreshold',
            payload: { value }
        });
    }
    
    function changeSort(sortBy) {
        vscode.postMessage({
            type: 'changeSort',
            payload: { sortBy }
        });
    }
    
    // Helper functions
    function sortChunks(chunks, sortBy) {
        const sorted = [...chunks];
        
        switch (sortBy) {
            case 'temporal':
                // Sort by timestamp, newest first
                return sorted.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
            case 'size':
                // Sort by token count, largest first
                return sorted.sort((a, b) => b.tokens - a.tokens);
            case 'type':
                // Return as-is, will group by type
                return sorted;
            default:
                return sorted;
        }
    }
    
    function groupChunksByTime(chunks) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const groups = {
            today: { label: 'Today', chunks: [], totalTokens: 0 },
            yesterday: { label: 'Yesterday', chunks: [], totalTokens: 0 },
            thisWeek: { label: 'This Week', chunks: [], totalTokens: 0 },
            older: { label: 'Older', chunks: [], totalTokens: 0 }
        };
        
        chunks.forEach(chunk => {
            const chunkDate = new Date(chunk.timestamp);
            let group;
            
            if (chunkDate >= today) {
                group = groups.today;
            } else if (chunkDate >= yesterday) {
                group = groups.yesterday;
            } else if (chunkDate >= lastWeek) {
                group = groups.thisWeek;
            } else {
                group = groups.older;
            }
            
            group.chunks.push(chunk);
            group.totalTokens += chunk.tokens;
        });
        
        // Return only non-empty groups
        return Object.values(groups).filter(g => g.chunks.length > 0)
            .map(g => ({
                ...g,
                label: `${g.label} - ${Math.round(g.totalTokens/1000)}k tokens`
            }));
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
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();