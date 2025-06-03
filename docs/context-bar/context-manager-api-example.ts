// context-manager-api.ts
// Example of how the VS Code extension would fetch and update context data

import * as vscode from 'vscode';
import { ContextPayload, ContextChunk, ChunkAction } from './context-manager-types';

export class ContextManagerAPI {
    private currentPayload: ContextPayload | null = null;
    private updateCallback: ((payload: ContextPayload) => void) | null = null;
    
    constructor(private context: vscode.ExtensionContext) {}
    
    // Simulate fetching context data from your backend/service
    async fetchContextData(): Promise<ContextPayload> {
        try {
            // In a real implementation, this would call your API
            // For now, we'll use mock data or stored state
            
            const storedData = this.context.globalState.get<ContextPayload>('contextData');
            if (storedData) {
                this.currentPayload = storedData;
                return storedData;
            }
            
            // Generate initial mock data
            const mockData = this.generateInitialPayload();
            this.currentPayload = mockData;
            await this.context.globalState.update('contextData', mockData);
            return mockData;
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch context data: ${error}`);
            throw error;
        }
    }
    
    // Delete a chunk
    async deleteChunk(chunkId: string): Promise<ContextPayload> {
        if (!this.currentPayload) {
            throw new Error('No context data loaded');
        }
        
        // Find and remove the chunk
        const chunkIndex = this.currentPayload.chunks.findIndex(c => c.id === chunkId);
        if (chunkIndex === -1) {
            throw new Error(`Chunk ${chunkId} not found`);
        }
        
        const deletedChunk = this.currentPayload.chunks[chunkIndex];
        this.currentPayload.chunks.splice(chunkIndex, 1);
        
        // Update usage
        this.currentPayload.contextUsage.current -= deletedChunk.tokens;
        this.currentPayload.contextUsage.percentage = Math.round(
            (this.currentPayload.contextUsage.current / this.currentPayload.contextUsage.maximum) * 100
        );
        
        // Update temporal groups
        this.updateTemporalGroups();
        
        // Update statistics
        this.updateStatistics();
        
        // Save and notify
        await this.savePayload();
        this.notifyUpdate();
        
        return this.currentPayload;
    }
    
    // Execute a custom action on a chunk
    async executeChunkAction(chunkId: string, actionId: string): Promise<ContextPayload> {
        if (!this.currentPayload) {
            throw new Error('No context data loaded');
        }
        
        const chunk = this.currentPayload.chunks.find(c => c.id === chunkId);
        if (!chunk) {
            throw new Error(`Chunk ${chunkId} not found`);
        }
        
        // Handle different actions
        switch (actionId) {
            case 'extractKeyPoints':
                await this.extractKeyPoints(chunk);
                break;
            case 'keepAnalysisOnly':
                await this.keepAnalysisOnly(chunk);
                break;
            case 'summarize':
                await this.summarizeChunk(chunk);
                break;
            default:
                throw new Error(`Unknown action: ${actionId}`);
        }
        
        await this.savePayload();
        this.notifyUpdate();
        
        return this.currentPayload;
    }
    
    // Update threshold setting
    async updateThreshold(value: number): Promise<void> {
        if (!this.currentPayload) {
            throw new Error('No context data loaded');
        }
        
        this.currentPayload.settings.autoCleanupThreshold = value;
        await this.savePayload();
        this.notifyUpdate();
        
        // Trigger auto-cleanup if needed
        if (this.currentPayload.settings.autoCleanupEnabled && 
            this.currentPayload.contextUsage.percentage >= value) {
            await this.triggerAutoCleanup();
        }
    }
    
    // Change sort order
    async changeSortOrder(sortBy: 'temporal' | 'type' | 'size'): Promise<void> {
        if (!this.currentPayload) {
            throw new Error('No context data loaded');
        }
        
        this.currentPayload.settings.sortBy = sortBy;
        await this.savePayload();
        this.notifyUpdate();
    }
    
    // Subscribe to updates
    onUpdate(callback: (payload: ContextPayload) => void): vscode.Disposable {
        this.updateCallback = callback;
        return new vscode.Disposable(() => {
            this.updateCallback = null;
        });
    }
    
    // Private helper methods
    
    private async extractKeyPoints(chunk: ContextChunk): Promise<void> {
        // Simulate extracting key points from a file
        vscode.window.showInformationMessage(`Extracting key points from ${chunk.title}...`);
        
        // Create a new analysis chunk with the extracted points
        const analysisChunk: ContextChunk = {
            id: `chunk_analysis_${Date.now()}`,
            type: 'analysis',
            title: `Key Points: ${chunk.title}`,
            description: 'Extracted insights and key points',
            tokens: Math.floor(chunk.tokens * 0.2), // 20% of original
            timestamp: new Date().toISOString(),
            metadata: {
                source: 'computation',
                parentChunk: chunk.id,
                analysisType: 'extraction',
                dataPoints: 15
            },
            actions: {
                canDelete: true,
                canSummarize: true,
                canExtract: false,
                canArchive: true
            },
            visual: {
                icon: '📊',
                color: '#4ec9b0'
            }
        };
        
        // Add the analysis chunk
        this.currentPayload!.chunks.push(analysisChunk);
        
        // Update the original chunk to show it has been extracted
        chunk.metadata.extractedInsights = true;
        chunk.description += ' (insights extracted)';
    }
    
    private async keepAnalysisOnly(chunk: ContextChunk): Promise<void> {
        // Find related analysis chunks
        const analysisChunks = this.currentPayload!.chunks.filter(
            c => c.metadata.parentChunk === chunk.id
        );
        
        if (analysisChunks.length === 0) {
            vscode.window.showWarningMessage('No analysis found for this file. Extract insights first.');
            return;
        }
        
        // Delete the original chunk
        await this.deleteChunk(chunk.id);
        
        vscode.window.showInformationMessage(`Kept analysis only for ${chunk.title}`);
    }
    
    private async summarizeChunk(chunk: ContextChunk): Promise<void> {
        vscode.window.showInformationMessage(`Summarizing ${chunk.title}...`);
        
        // Simulate summarization - reduce tokens by 70%
        chunk.tokens = Math.floor(chunk.tokens * 0.3);
        chunk.title += ' (summarized)';
        chunk.description = 'Summarized version: ' + chunk.description;
        chunk.metadata.messageCount = Math.floor((chunk.metadata.messageCount || 0) * 0.3);
        
        // Update usage
        this.recalculateUsage();
    }
    
    private async triggerAutoCleanup(): Promise<void> {
        // Find candidates for cleanup
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        const oldChunks = this.currentPayload!.chunks.filter(chunk => {
            const chunkTime = new Date(chunk.timestamp).getTime();
            return chunkTime < oneWeekAgo;
        });
        
        if (oldChunks.length > 0) {
            const action = await vscode.window.showInformationMessage(
                `Auto-cleanup: ${oldChunks.length} old chunks found. Delete them?`,
                'Yes', 'No'
            );
            
            if (action === 'Yes') {
                for (const chunk of oldChunks) {
                    await this.deleteChunk(chunk.id);
                }
            }
        }
    }
    
    private updateTemporalGroups(): void {
        // Re-group chunks by time
        const groups = new Map<string, { chunks: string[], tokens: number }>();
        
        this.currentPayload!.chunks.forEach(chunk => {
            const date = new Date(chunk.timestamp);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let groupId: string;
            if (date >= today) {
                groupId = 'today';
            } else if (date >= yesterday) {
                groupId = 'yesterday';
            } else {
                groupId = 'older';
            }
            
            if (!groups.has(groupId)) {
                groups.set(groupId, { chunks: [], tokens: 0 });
            }
            
            const group = groups.get(groupId)!;
            group.chunks.push(chunk.id);
            group.tokens += chunk.tokens;
        });
        
        // Convert to temporal groups array
        this.currentPayload!.temporalGroups = Array.from(groups.entries()).map(([id, data]) => ({
            id,
            label: id.charAt(0).toUpperCase() + id.slice(1),
            dateRange: { start: '', end: '' }, // Simplified
            chunkIds: data.chunks,
            totalTokens: data.tokens
        }));
    }
    
    private updateStatistics(): void {
        const chunks = this.currentPayload!.chunks;
        const byType: any = {};
        
        chunks.forEach(chunk => {
            if (!byType[chunk.type]) {
                byType[chunk.type] = { count: 0, tokens: 0 };
            }
            byType[chunk.type].count++;
            byType[chunk.type].tokens += chunk.tokens;
        });
        
        const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
        
        this.currentPayload!.statistics = {
            totalChunks: chunks.length,
            byType,
            oldestChunk: chunks.length > 0 ? chunks[chunks.length - 1].timestamp : '',
            newestChunk: chunks.length > 0 ? chunks[0].timestamp : '',
            averageChunkSize: chunks.length > 0 ? Math.floor(totalTokens / chunks.length) : 0
        };
    }
    
    private recalculateUsage(): void {
        const totalTokens = this.currentPayload!.chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
        this.currentPayload!.contextUsage.current = totalTokens;
        this.currentPayload!.contextUsage.percentage = Math.round(
            (totalTokens / this.currentPayload!.contextUsage.maximum) * 100
        );
    }
    
    private async savePayload(): Promise<void> {
        if (this.currentPayload) {
            this.currentPayload.timestamp = new Date().toISOString();
            await this.context.globalState.update('contextData', this.currentPayload);
        }
    }
    
    private notifyUpdate(): void {
        if (this.updateCallback && this.currentPayload) {
            this.updateCallback(this.currentPayload);
        }
    }
    
    private generateInitialPayload(): ContextPayload {
        // Use the mock data generator from the examples
        return {
            contextUsage: {
                current: 76000,
                maximum: 100000,
                percentage: 76,
                unit: "tokens"
            },
            settings: {
                autoCleanupThreshold: 40,
                autoCleanupEnabled: true,
                sortBy: "temporal",
                groupByTime: true
            },
            chunks: [],
            temporalGroups: [],
            statistics: {
                totalChunks: 0,
                byType: {},
                oldestChunk: '',
                newestChunk: '',
                averageChunkSize: 0
            },
            suggestions: [],
            version: "1.0",
            timestamp: new Date().toISOString()
        };
    }
}