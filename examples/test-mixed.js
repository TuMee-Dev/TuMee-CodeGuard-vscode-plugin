// Test file for mixed/overlapping guard permissions

// @guard:ai:n
function secretFunction() {
    // @guard:ai:r.5
    // This section has overlapping guards
    // AI has both 'n' from outer and 'r' from inner
    const overlappingCode = true;
    
    return overlappingCode;
}

// @guard:human:n
class PrivateClass {
    // @guard:human:r.3
    // Another overlap - human has both 'n' and 'r'
    constructor() {
        this.mixed = true;
    }
}