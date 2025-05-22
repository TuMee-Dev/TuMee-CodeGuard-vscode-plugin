# Markdown Guard Tags Test

This file tests the improved handling of guard tags in markdown files.
The extension should only recognize guard tags within HTML comments.

## Regular text that should not be highlighted

This is some text that contains @guard:ai:r but it's NOT in a comment,
so it should not be recognized or highlighted.

Another example: @guard:ai:w should be ignored.
And @guard:ai:n.5 should also be ignored.

## Proper guard tags in comments

<!-- @guard:ai:r -->
This content should be recognized as read-only for AI because the guard tag
is inside a proper HTML comment.

## Testing line count syntax with explicit count

<!-- @guard:ai:w.3 -->
This line should be highlighted as AI write access.
This is line 2 of 3 with AI write access.
This is line 3 of 3 with AI write access.

Back to normal (read-only) since the line count expired.

## Testing another line count

<!-- @guard:ai:n.2 -->
This content should be highlighted as AI no access (green).
This is line 2 of 2 with AI no access.

Back to normal (no highlighting) after the line count expires.

## Testing nested line counts

<!-- @guard:ai:w.4 -->
Line 1 of 4 with AI write access.
<!-- @guard:ai:n.2 -->
This should override with "no access" for 2 lines.
This is line 2 of 2 with AI no access.
Line 4 of 4 with AI write access (the previous "no access" override has expired).

Back to normal (no highlighting) after all line counts expire.

## Testing non-highlighted sections

Regular markdown content that should not be highlighted at all.

```javascript
// This is a code block that contains a comment with @guard:ai:w
// but since it's in a code block in markdown, it should be treated
// as part of the markdown document, not a real guard tag.
```

## Final section with proper guard tag

<!-- @guard:ai:w -->
This section should be highlighted as AI write access again.