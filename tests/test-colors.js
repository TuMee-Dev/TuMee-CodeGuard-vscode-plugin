// This line should have default permissions (ai:r, human:w)
// Based on directory ACL, it should be ai:w, human:w
// With your theme, ai:w + human:w should show as orange (ai write color)

// @guard:human:r
// This should now be ai:w, human:r
// Should show as grey (human read color)

// @guard:ai:r
// This should now be ai:r, human:r  
// Should show as grey (ai:r + human:r combination)

// @guard:human:w
// This should now be ai:r, human:w
// Should show as transparent (no color) if humanWrite is disabled

// @guard:ai:w
// This should be ai:w, human:w
// Should show as orange (ai write color)