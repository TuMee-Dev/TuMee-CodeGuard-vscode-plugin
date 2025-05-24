// Test context guards - they should only apply to documentation

// @guard:internal:read.context
// This comment should be guarded
// And this one too
// Even this one
function publicFunction() {
    // This code should NOT be guarded
    console.log("I'm not guarded!");
}

// @guard:sensitive:none.context
/**
 * This JSDoc comment should be guarded
 * All of these lines too
 * @param {string} name - Even parameter docs
 * @returns {string} And return docs
 */
function sensitiveFunction(name) {
    // But this code is NOT guarded
    return `Hello ${name}`;
}

class MyClass {
    // @guard:private:write.context
    /**
     * This method documentation is guarded
     * Multiple lines of docs
     */
    myMethod() {
        // This method body is NOT guarded
        return 42;
    }
}

// Test multi-line comment blocks
// @guard:admin:execute.context
/*
 * This entire block comment
 * should be guarded
 * until we hit code
 */
const someCode = "Not guarded";

// Test empty lines in documentation
// @guard:team:read.context
// First line of docs
//
// Empty line above but still in docs
//
// Another line
const moreCode = "Also not guarded";