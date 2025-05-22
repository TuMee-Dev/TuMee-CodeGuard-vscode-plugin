# Comprehensive Test for Both Bugs

# Default state - no highlighting
print("This line has no guard tag")

# Bug 1 Test: Bounded region (r.2) inside unbounded region (w)
# @guard:ai:w
print("This starts an unbounded WRITE region (red)")

# @guard:ai:r.2
print("This is line 1 of READ-ONLY region (no color)")
print("This is line 2 of READ-ONLY region (no color)")
print("This should revert to WRITE mode (red) - BUG 1 TEST")

# Bug 2 Test: Empty line after bounded region
print("This line should still be in WRITE mode (red)")

# Empty line below should be in WRITE mode too - BUG 2 TEST

# Bug 1 Test: Bounded region (n.3) inside unbounded region (w)
# @guard:ai:n.3
print("This is line 1 of NO ACCESS region (green)")
print("This is line 2 of NO ACCESS region (green)")
print("This is line 3 of NO ACCESS region (green)")
print("This should revert to WRITE mode (red) - BUG 1 TEST")

# Bug 2 Test: Multiple empty lines
print("This line should still be in WRITE mode (red)")



# New unbounded region
# @guard:ai:r
print("This starts an unbounded READ-ONLY region (no color)")

# @guard:ai:w.1
print("This is ONE line in WRITE mode (red)")
print("This should revert to READ-ONLY (no color) - BUG 1 TEST")

# Bug 2 Test: Empty line after bounded region ending
# Empty line below should be in READ-ONLY mode - BUG 2 TEST

# End of file - should be READ-ONLY