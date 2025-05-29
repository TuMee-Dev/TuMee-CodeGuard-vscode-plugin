import type { OutputChannel } from 'vscode';
import { window } from 'vscode';
import { getConfig, configManager, CONFIG_KEYS } from './configurationManager';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  details?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers = new Map<string, number>();
  private outputChannel: OutputChannel | undefined;
  private enabled = false;

  constructor() {
    // Check if performance monitoring is enabled
    this.updateConfiguration();

    // Listen for configuration changes
    configManager().onDidChangeConfiguration(
      CONFIG_KEYS.ENABLE_PERFORMANCE_MONITORING,
      () => this.updateConfiguration()
    );
  }

  private updateConfiguration(): void {
    this.enabled = getConfig(CONFIG_KEYS.ENABLE_PERFORMANCE_MONITORING, false);

    if (this.enabled && !this.outputChannel) {
      this.outputChannel = window.createOutputChannel('TuMee Performance');
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    if (!this.enabled) return;

    this.timers.set(operation, performance.now());
  }

  /**
   * End timing an operation and record the metric
   */
  endTimer(operation: string, details?: Record<string, unknown>): number {
    if (!this.enabled) return 0;

    const startTime = this.timers.get(operation);
    if (startTime === undefined) {
      console.warn(`Timer for ${operation} was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(operation);

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      details
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics to avoid memory issues
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    // Log to output channel if enabled
    if (this.outputChannel) {
      const detailsStr = details ? ` | ${JSON.stringify(details)}` : '';
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ${operation}: ${duration.toFixed(2)}ms${detailsStr}`
      );
    }

    return duration;
  }

  /**
   * Measure the duration of an async operation
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    details?: Record<string, unknown>
  ): Promise<T> {
    if (!this.enabled) return fn();

    this.startTimer(operation);
    try {
      const result = await fn();
      this.endTimer(operation, details);
      return result;
    } catch (error) {
      this.endTimer(operation, { ...details, error: true });
      throw error;
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getStats(operation: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
  } | null {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);

    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: operationMetrics.length,
      avgDuration: sum / operationMetrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }

  /**
   * Generate a performance report
   */
  generateReport(): string {
    const operationGroups = new Map<string, PerformanceMetric[]>();

    // Group metrics by operation
    for (const metric of this.metrics) {
      const group = operationGroups.get(metric.operation) || [];
      group.push(metric);
      operationGroups.set(metric.operation, group);
    }

    let report = 'TuMee Performance Report\n';
    report += '========================\n\n';

    for (const [operation] of operationGroups) {
      const stats = this.getStats(operation);
      if (stats) {
        report += `${operation}:\n`;
        report += `  Count: ${stats.count}\n`;
        report += `  Avg: ${stats.avgDuration.toFixed(2)}ms\n`;
        report += `  Min: ${stats.minDuration.toFixed(2)}ms\n`;
        report += `  Max: ${stats.maxDuration.toFixed(2)}ms\n\n`;
      }
    }

    return report;
  }

  /**
   * Show performance report in output channel
   */
  showReport(): void {
    if (!this.outputChannel) {
      this.outputChannel = window.createOutputChannel('TuMee Performance');
    }

    this.outputChannel.clear();
    this.outputChannel.append(this.generateReport());
    this.outputChannel.show();
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel?.dispose();
    this.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();