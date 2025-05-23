# Test file for Python semantic scope guards

# @guard:ai:r.func
def read_only_function():
    """This entire function should be read-only"""
    x = 10
    y = 20
    return x + y

# @guard:ai:n.class
class NoAccessClass:
    """This entire class should have no AI access"""
    
    def __init__(self):
        self.value = 42
    
    def get_value(self):
        return self.value
    
    def set_value(self, new_value):
        self.value = new_value

# @guard:ai:w.body
def writeable_body():
    """Only the body should be writeable, not the signature"""
    # This body can be modified
    data = []
    for i in range(10):
        data.append(i)
    return data

# @guard:ai:r.sig
def read_only_signature(param1, param2, param3):
    """The function signature should be read-only"""
    # But this body can be modified
    return param1 + param2 + param3

# @guard:ai:n.block
if __name__ == "__main__":
    # This entire block should have no access
    import os
    secret_key = os.environ.get("SECRET_KEY")
    api_token = os.environ.get("API_TOKEN")
    print("Sensitive operations")

class TestClass:
    # @guard:ai:r.method
    def important_method(self):
        """This method should be read-only"""
        return "important data"
    
    def regular_method(self):
        """This method is not guarded"""
        return "regular data"

# @guard:ai:context
# This comment marks context information
# that AI should read but not necessarily modify