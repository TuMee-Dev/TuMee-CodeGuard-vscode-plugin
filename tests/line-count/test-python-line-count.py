# Test file for Python line count with guard tags

# Regular guard tag (works)
# @guard:ai:r
def regular_function():
    return "This is read-only for AI"

# Line count guard tag (not working) 
# @guard:ai:r.2
def line_count_function():
    x = "This should be read-only for 2 lines"
    return x

# This line should be back to default

# Another line count test
# @guard:ai:w.3
x = "This should have AI write access"
y = "This is line 2 of 3"
z = "This is line 3 of 3"

# This should be back to default

# Test for no access with line count
# @guard:ai:n.2
secret_key = "12345"
password = "abcde"

# This should be back to default