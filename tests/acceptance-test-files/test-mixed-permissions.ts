// @guard:ai:w
interface PublicAPI {
  getData(): string;
}

// @guard:human:w  
class SensitiveImplementation implements PublicAPI {
  private secret = "classified";
  
  getData(): string {
    // @guard:ai:r
    return "public data";
  }
}

// @guard:ai:context
// This is context information for AI
const contextInfo = "AI can use this for understanding";