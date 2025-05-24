# Test context guards in Python

# @guard:internal:read.context
# This comment should be guarded
# And this one too
# Even this one
def public_function():
    # This code should NOT be guarded
    print("I'm not guarded!")

# @guard:sensitive:none.context
"""
This docstring should be guarded
All of these lines too
Even with multiple paragraphs

And empty lines in between
"""
def sensitive_function(name):
    # But this code is NOT guarded
    return f"Hello {name}"

class MyClass:
    # @guard:private:write.context
    """
    This class method documentation is guarded
    Multiple lines of docs
    """
    def my_method(self):
        # This method body is NOT guarded
        return 42

# Test module-level docstrings
# @guard:admin:execute.context
"""
This module-level docstring
should be guarded
until we hit code
"""
some_code = "Not guarded"

# Test mixed documentation
# @guard:team:read.context
# First line of docs
#
# Empty line above but still in docs
#
# Another line
more_code = "Also not guarded"

# @guard:special:none.context
# Comment block
# More comments
# Even more

# This is a separate comment block (not guarded)
unrelated_code = True