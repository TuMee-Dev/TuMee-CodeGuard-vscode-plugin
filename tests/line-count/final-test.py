# Final test case for the line count issue
# We will verify this pattern works: # @guard:ai:x.N

# This line has no guard tag

# @guard:ai:r.2
print("This should be READ-ONLY line 1 of 2")
print("This should be READ-ONLY line 2 of 2")
print("This should return to DEFAULT state (no highlighting)")

# @guard:ai:w.3
print("This should be WRITE (red) line 1 of 3")
print("This should be WRITE (red) line 2 of 3")
print("This should be WRITE (red) line 3 of 3")
print("This should return to DEFAULT state (no highlighting)")

# @guard:ai:n.1
print("This should be NO ACCESS (green) for ONLY this line")
print("This should return to DEFAULT state (no highlighting)")

# Testing an adjacent guard
# @guard:ai:w.2
print("This should be WRITE (red) line 1 of 2")
print("This should be WRITE (red) line 2 of 2")
# @guard:ai:r
print("This should be READ-ONLY until the next guard tag")
print("This should still be READ-ONLY")

# @guard:ai:n
print("This should be NO ACCESS (green) until the end of file")
print("This should still be NO ACCESS (green)")