// API Key Manager Example - TypeScript with all guard tag colors

// # @guard:ai:w.class @guard:human:r.class
interface ApiConfig {
    version: string;
    environment: string;
    timeout: number;
}

// @guard:ai:w
// AI can optimize this service configuration - RED highlight
export class ServiceManager {
    private config: ApiConfig = {
        version: '3.0.0',
        environment: process.env.NODE_ENV || 'development',
        timeout: 5000
    };
    
    getConfig(): ApiConfig {
        return { ...this.config };
    }
}

// @guard:ai:n
// Sensitive OAuth tokens - AI must not access - GREEN highlight
const OAUTH_TOKENS = {
    github: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    google: 'ya29.a0ARrdaM_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    microsoft: 'EwBwA8l6BAAURSN_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'
};

// @guard:human:r
// Audit trail configuration - humans cannot modify - PURPLE highlight
const AUDIT_CONFIG = Object.freeze({
    retention_days: 2555, // 7 years for SOX compliance
    encryption_required: true,
    tamper_proof: true,
    compliance_standards: ['SOX', 'HIPAA', 'PCI-DSS']
});

// @guard:ai:w
// AI can improve this rate limiting logic - RED highlight (2nd occurrence)
export class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private readonly windowMs: number = 60000; // 1 minute
    
    checkLimit(clientId: string, limit: number): boolean {
        const now = Date.now();
        const timestamps = this.requests.get(clientId) || [];
        
        // AI can optimize this sliding window algorithm
        const recentRequests = timestamps.filter(t => now - t < this.windowMs);
        
        if (recentRequests.length >= limit) {
            return false;
        }
        
        recentRequests.push(now);
        this.requests.set(clientId, recentRequests);
        return true;
    }
}

// @guard:human:n
// ML model weights - humans should not modify - ORANGE highlight
const ANOMALY_DETECTION_WEIGHTS = {
    layer1: new Float32Array([0.123, -0.456, 0.789, 0.012, -0.345]),
    layer2: new Float32Array([0.678, -0.901, 0.234, -0.567, 0.890]),
    bias: new Float32Array([0.111, -0.222, 0.333]),
    threshold: 0.85
};

// @guard:ai:context
// API Gateway Architecture - CYAN highlight

// Request flow: Client -> Load Balancer -> API Gateway -> Services
// Authentication: OAuth2 + JWT with 15-minute token expiry
// Rate limiting: 1000 requests/minute per client
// Caching: Redis with 5-minute TTL for GET requests
// Monitoring: Prometheus metrics exported on :9090/metrics

// @guard:ai:n
// Payment processor credentials - GREEN highlight (2nd occurrence)
interface PaymentCredentials {
    stripe_secret: string;
    paypal_client_secret: string;
    square_access_token: string;
}

const PAYMENT_CREDS: PaymentCredentials = {
    stripe_secret: 'sk_live_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    paypal_client_secret: 'EBWKjlELxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    square_access_token: 'sq0atp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
};

// @guard:human:r
// Legal disclaimer text - PURPLE highlight (2nd occurrence)
const LEGAL_DISCLAIMER = `
This software is provided "as is" without warranty of any kind.
Modification of this legal text requires approval from Legal Department.
Last approved: 2024-01-15 by General Counsel.
Case reference: LEGAL-2024-0042
`;

// @guard:ai:w
// AI can enhance error recovery logic - RED highlight (3rd occurrence)
export class ErrorRecoveryService {
    private retryAttempts: Map<string, number> = new Map();
    
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationId: string,
        maxRetries: number = 3
    ): Promise<T> {
        const attempts = this.retryAttempts.get(operationId) || 0;
        
        try {
            const result = await operation();
            this.retryAttempts.delete(operationId);
            return result;
        } catch (error) {
            if (attempts < maxRetries) {
                this.retryAttempts.set(operationId, attempts + 1);
                // AI can improve backoff strategy
                const backoffMs = Math.pow(2, attempts) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return this.executeWithRetry(operation, operationId, maxRetries);
            }
            throw error;
        }
    }
}

// @guard:human:n
// AI-optimized cache eviction policy - ORANGE highlight (2nd occurrence)
const CACHE_EVICTION_RULES = {
    algorithm: 'W-TinyLFU', // Weighted Tiny Least Frequently Used
    window_size: 1000,
    probation_size: 200,
    protected_size: 800,
    frequency_sketch_size: 10000,
    // Complex mathematical formula optimized by AI
    admission_filter: (freq: number, recency: number) => {
        return (freq * 0.7 + recency * 0.3) > 0.6;
    }
};

// @guard:ai:context
// Deployment Configuration - CYAN highlight (2nd occurrence)
// Production: 3 regions (us-east-1, eu-west-1, ap-southeast-1)
// Disaster Recovery: RPO = 1 hour, RTO = 4 hours
// Backup strategy: Hourly snapshots, daily full backups
// Scaling: Auto-scale between 10-100 instances based on CPU > 70%
// Health checks: /health endpoint every 30 seconds

// @guard:ai:n
// Encryption keys for data at rest - GREEN highlight (3rd occurrence)
const ENCRYPTION_KEYS = {
    master_key: 'MK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    data_encryption_key: 'DEK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    key_encryption_key: 'KEK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    initialization_vector: 'IV-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
};

// Module exports
export default {
    ServiceManager,
    RateLimiter,
    ErrorRecoveryService,
    AUDIT_CONFIG,
    LEGAL_DISCLAIMER
};