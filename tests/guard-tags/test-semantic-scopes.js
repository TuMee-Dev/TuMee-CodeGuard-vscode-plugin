// Test file for semantic scope guards
// This file demonstrates various semantic scopes

// @guard:ai:r.func
function readOnlyFunction() {
    console.log("This entire function should be read-only");
    const x = 10;
    return x * 2;
}

// @guard:ai:n.class
class NoAccessClass {
    constructor() {
        this.value = 42;
    }
    
    getValue() {
        return this.value;
    }
    
    setValue(newValue) {
        this.value = newValue;
    }
}

// @guard:ai:w.body
function writeableBody() {
    // Only the body should be writeable, not the signature
    console.log("This body can be modified");
    const data = [];
    for (let i = 0; i < 10; i++) {
        data.push(i);
    }
    return data;
}

// @guard:ai:r.sig
function readOnlySignature(param1, param2, param3) {
    // The function signature should be read-only
    // But this body can be modified
    return param1 + param2 + param3;
}

// @guard:ai:n.block
if (process.env.NODE_ENV === 'production') {
    // This entire block should have no access
    const secretKey = process.env.SECRET_KEY;
    const apiToken = process.env.API_TOKEN;
    console.log("Sensitive operations");
}

// Test nested function with method scope
class TestClass {
    // @guard:ai:r.method
    importantMethod() {
        // This method should be read-only
        return "important data";
    }
    
    regularMethod() {
        // This method is not guarded
        return "regular data";
    }
}

// @guard:ai:context
// This comment marks context information
// that AI should read but not necessarily modify

export { readOnlyFunction, NoAccessClass, TestClass, readOnlySignature };