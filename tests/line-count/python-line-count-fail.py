# Python Test File to demonstrate line count failure

# NO GUARD TAG - should have default formatting (no special highlight)
print("This line has no guard tag")

# @guard:ai:r.3
print("Line 1: Should be read-only for AI for 3 lines")
print("Line 2: Still r state, part of the 3-line block")
print("Line 3: Still r state, last line of the 3-line block")

print("This line should NOT be r state anymore - back to default")

# @guard:ai:w.2
print("Line 1: Should have w state (red highlight) for 2 lines")
print("Line 2: Still w state, last line of the 2-line block")

print("This line should NOT be w state anymore - back to default")

# Regular guard with no line count
# @guard:ai:n
print("This has n state until the next guard tag")

# End of file