# Test file for inline signature guards

# Test 1: Guard on separate line (should highlight 2 lines)
# @guard:ai:r.sig
def separate_line_guard(param1, param2):
    """This should have 2 lines highlighted: comment line and def line"""
    return param1 + param2

# Test 2: Guard inline with signature (should highlight 1 line only)
def inline_guard(param1, param2): # @guard:ai:r.sig
    """Only the def line should be highlighted, not this docstring"""
    return param1 * param2

# Test 3: Python __init__ example from the issue
class TestClass:
    def __init__(self, history_size=100): # @guard:ai:r.sig
        """Only the __init__ line should be highlighted"""
        self.history_size = history_size
        self.data = []
    
    # @guard:ai:r.sig
    def separate_method(self):
        """Both the comment and def line should be highlighted"""
        return self.data

# Test 4: Multi-line signature with inline guard
def multi_line_sig(
    very_long_param_name_1,
    very_long_param_name_2,
    very_long_param_name_3): # @guard:ai:r.sig
    """For now, only the closing paren line is highlighted"""
    return sum([very_long_param_name_1, very_long_param_name_2, very_long_param_name_3])

# Test 5: Regular line count still works
# @guard:ai:n.3
print("Line 1 of 3")
print("Line 2 of 3")
print("Line 3 of 3")
print("This line is NOT guarded")