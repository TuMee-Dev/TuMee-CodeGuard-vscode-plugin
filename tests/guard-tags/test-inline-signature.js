// Test file for inline signature guards in JavaScript

// Test 1: Guard on separate line (should highlight 2 lines)
// @guard:ai:r.sig
function separateLineGuard(param1, param2) {
    // This should have 2 lines highlighted: comment line and function line
    return param1 + param2;
}

// Test 2: Guard inline with signature (should highlight 1 line only)
function inlineGuard(param1, param2) { // @guard:ai:r.sig
    // Only the function line should be highlighted, not this comment
    return param1 * param2;
}

// Test 3: Arrow function with inline guard
const arrowFunc = (a, b) => { // @guard:ai:r.sig
    // Only the arrow function line should be highlighted
    return a + b;
};

// Test 4: Class method example
class TestClass {
    constructor(historySize = 100) { // @guard:ai:r.sig
        // Only the constructor line should be highlighted
        this.historySize = historySize;
        this.data = [];
    }
    
    // @guard:ai:r.sig
    separateMethod() {
        // Both the comment and method line should be highlighted
        return this.data;
    }
}

// Test 5: Async function with inline guard
async function asyncFunc(url) { // @guard:ai:r.sig
    // Only the async function line should be highlighted
    const response = await fetch(url);
    return response.json();
}

// Test 6: Regular line count still works
// @guard:ai:n.3
console.log("Line 1 of 3");
console.log("Line 2 of 3");
console.log("Line 3 of 3");
console.log("This line is NOT guarded");