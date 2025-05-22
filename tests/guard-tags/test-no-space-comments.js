// Test file for guard tags without spaces after comment markers

//@guard:ai:n
// No space after comment marker - AI No Access
function noSpaceNoAccess() {
    return "This function has no space after comment marker";
}

//@guard:ai:r
// No space after comment marker - AI Read-Only
function noSpaceReadOnly() {
    return "This function has no space after comment marker";
}

//@guard:ai:w
// No space after comment marker - AI Write
function noSpaceWrite() {
    return "This function has no space after comment marker";
}

# Test Python comment style
#@guard:ai:n
# No space after Python comment
def pythonNoSpace():
    return "This function has no space after Python comment"

# Test Ruby comment style
#@guard:ai:r
# No space after Ruby comment
def rubyNoSpace():
    return "This function has no space after Ruby comment"

// Test different indentation levels
    //@guard:ai:w
    // Indented comment with no space
    function indentedNoSpace() {
        return "This function has indented comment with no space";
    }

/* Test block comments */
/*@guard:ai:n
 * No space after block comment start
 */
function blockCommentNoSpace() {
    return "This function has no space after block comment";
}

module.exports = {
    noSpaceNoAccess,
    noSpaceReadOnly,
    noSpaceWrite,
    indentedNoSpace,
    blockCommentNoSpace
};