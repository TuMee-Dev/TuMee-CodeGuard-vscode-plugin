# Test file for line count debugging

print("This is the first line with no guard tag")

# @guard:ai:r.3
print("This line should have r state, line 1 of 3")
print("This line should have r state, line 2 of 3")
print("This line should have r state, line 3 of 3")

print("This line should have returned to default state")

# @guard:ai:w.2
print("This line should have w state, line 1 of 2")
print("This line should have w state, line 2 of 2")

print("This line should have returned to default state")

# Regular guards without line count
# @guard:ai:n
print("This line should be n state until the next guard")

# @guard:ai:r
print("This line should be r state")