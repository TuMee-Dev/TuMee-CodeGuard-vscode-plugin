// Test file for different comment styles with guard tags
// This file contains the same guard tags using different comment styles

/**
 * Helper function to log messages
 * @param {string} message The message to log
 */
function logMessage(message) {
    console.log(`[TuMee Plugin]: ${message}`);
}

// @guard:ai:r
// Traditional JavaScript single-line comment with guard tag
function jsSingleLineComment() {
    return "This is a JS single-line comment style";
}


/* @guard:ai:w 
   JavaScript block comment with guard tag
*/
function jsBlockComment() {
    return "This is a JS block comment style";
}


# @guard:ai:n
# Python/Ruby/Shell style comment with guard tag
function pythonStyleComment() {
    return "This is a Python-style comment";
}


<!-- @guard:ai:r -->
<!-- HTML/XML style comment with guard tag -->
function htmlStyleComment() {
    return "This is an HTML-style comment";
}


/** 
 * @guard:ai:w
 * JSDoc style comment with guard tag
 */
function jsDocComment() {
    return "This is a JSDoc style comment";
}


-- @guard:ai:n
-- SQL style comment with guard tag
function sqlStyleComment() {
    return "This is a SQL-style comment";
}


/** @guard:ai:r **/
// One-line block comment
function oneLineBlockComment() {
    return "This is a one-line block comment";
}


/**
* Some content before the tag
* @guard:ai:w
* Some content after the tag
*/
function contentAroundTag() {
    return "This has content around the tag";
}


module.exports = {
    jsSingleLineComment,
    jsBlockComment,
    pythonStyleComment,
    htmlStyleComment,
    jsDocComment,
    sqlStyleComment,
    oneLineBlockComment,
    contentAroundTag
};