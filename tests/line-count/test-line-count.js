// Test file for line count guard tags
// This demonstrates the optional line count feature in @guard:ai:permission.count

/**
 * Example function showcasing line count in guard tags
 */

// @guard:ai:r.3
// This guard only applies to the next 3 lines
function exampleFunctionWithLineCount() {
  const secretKey = "abcd1234"; // These 3 lines are read-only for AI
  return secretKey;
}

// After the 3 lines, we're back to the default state (no highlighting)
console.log("This line is not covered by the previous guard");

// @guard:ai:n.1
// This guard only applies to the next line
const sensitiveData = "1234-5678-9012-3456";

// Now we're back to default state
const regularData = "This is not sensitive";

// @guard:ai:w.5
// This guard applies to the next 5 lines
function aiEditableSection() {
  // AI can edit these 5 lines
  const data = {
    shouldProcess: true,
    value: 42
  };
  return data;
}

// Back to default state
console.log("Outside of AI editable section");

// Test with multiple guards in sequence
// @guard:ai:r.2
const config1 = { version: "1.0" };
const config2 = { enabled: true };

// @guard:ai:w.2
const config3 = { debug: false };
const config4 = { timeout: 30 };

// @guard:ai:n.2
const config5 = { key: "secret" };
const config6 = { password: "123456" };

module.exports = {
  exampleFunctionWithLineCount,
  aiEditableSection,
  sensitiveData,
  regularData,
  config1,
  config2,
  config3,
  config4,
  config5,
  config6
};