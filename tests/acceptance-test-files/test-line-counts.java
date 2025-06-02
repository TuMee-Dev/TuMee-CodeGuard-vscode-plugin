// @guard:ai:w.5
public class TestClass {
    public void method1() {
        System.out.println("Line 1");
        System.out.println("Line 2");  
    }
    
    // @guard:human:w.3
    private void sensitiveMethod() {
        // Critical logic
        doSomething();
    }
}