# Test file for stack-based guard processing
# @guard:ai:r
def function1():
    pass

# @guard:ai:w.2
def function2():
    pass

def function3():
    # This should revert to ai:r after line 8
    pass

# @guard:human:n
def function4():
    pass

# Line 17 should have human:n permission (most recent guard)