# Simple Python file to test guard tag line counts

# Regular line (no guard)
print("This is line with no guard tag")

# @guard:ai:r.3
print("This is line 1 of 3 with r permission")
print("This is line 2 of 3 with r permission")
print("This is line 3 of 3 with r permission")
print("This should be back to default - no r permission")

# @guard:ai:w.2
print("This is line 1 of 2 with w permission")
print("This is line 2 of 2 with w permission")
print("This should be back to default - no w permission")

# @guard:ai:n.1
print("This is the only line with n permission")
print("This should be back to default - no n permission")