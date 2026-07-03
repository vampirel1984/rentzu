---
applyTo: "**/*.*"
---

# Instructions - Code Modification Policy

## 🎯 Primary Directive

**DO NOT refactor existing code unless explicitly requested by the developer.**

## 📋 Code Modification Guidelines

### When Making Changes

#### ✅ DO:
- Make **minimal, targeted changes** to accomplish the specific task
- Add new functionality without altering working code
- Fix bugs in the immediate area of concern
- Follow existing patterns and styles in the codebase when making edits to existing code
- Preserve the current architecture and design patterns unless the developer specifies otherwise or other instructions indicate a change in pattern
- Entirely new pieces of functionality may follow a more modern or improved pattern if appropriate, but only if they do not interfere with existing code
- Add new methods, classes, or components alongside existing ones

#### ❌ DO NOT:
- Refactor code that is not directly related to the current task
- Change working code "just to make it better"
- Significantly restructure files or folders without explicit instruction
- Rename variables, methods, or classes that are not part of the task
- Change coding styles or formatting beyond the immediate changes
- Apply new patterns or architectures to existing code unprompted

### Scope of Changes

**Keep changes surgical and focused:**
- If asked to add a feature, add it without modifying unrelated code
- If asked to fix a bug, fix only that bug and its immediate cause
- If asked to update a method, update only that method unless dependencies require changes
- Touch only the files necessary to complete the specific request

### When Refactoring IS Appropriate

Only refactor when the developer explicitly:
- Uses words like "refactor", "restructure", "reorganize", or "clean up"
- Asks to "improve", "optimize", or "modernize" existing code
- Requests to apply specific patterns or principles to existing code
- Asks to consolidate, extract, or split existing functionality
- Specifically identifies code smell and asks for remediation

### Examples

**✅ Acceptable:**
- Developer: "Add a new endpoint for user authentication"
- Action: Create new endpoint without modifying existing endpoints

**✅ Acceptable:**
- Developer: "Fix the null reference exception in the GetUser method"
- Action: Fix only the null reference issue in GetUser

**✅ Acceptable:**
- Developer: "Refactor the UserService to use dependency injection"
- Action: Refactor UserService as requested

**❌ Not Acceptable:**
- Developer: "Add a new endpoint for user authentication"
- Action: Adding endpoint AND refactoring all existing endpoints to follow a new pattern

**❌ Not Acceptable:**
- Developer: "Fix the null reference exception in the GetUser method"
- Action: Fixing the bug AND rewriting the entire method to be "cleaner"

## 🛡️ Respect Existing Code

### Assume Intent
- Existing code was written deliberately, even if it seems suboptimal
- There may be historical reasons for current implementations
- What looks like "bad code" might have important context you're unaware of
- Legacy code often has hidden dependencies and business logic

### When Code Appears Problematic

If you notice code that violates clean code principles:
- **DO** complete the requested task using the existing patterns
- **DO** mention your observations in comments/suggestions if relevant
- **DO NOT** refactor it unless explicitly asked
- **DO NOT** assume you know better without full context

### Incremental Improvement

Code quality improves through:
- Deliberate, planned refactoring sessions
- Developer-driven improvements based on team discussion
- **NOT** through unsolicited changes during unrelated tasks

## 🎯 Developer Trust

**Respect the developer's judgment:**
- They know their codebase better than you do
- They understand the business context and constraints
- They can make informed decisions about when refactoring is appropriate
- They will ask for refactoring when they're ready for it

## ⚠️ Critical Reminder

**Your role is to assist, not to impose.**

Make the changes requested—nothing more, nothing less. Let the developer drive architectural decisions and code improvements.

---

> **Remember:** The best change is often the smallest change that accomplishes the goal. When in doubt, do less, not more.

> This file is intended for all contributors and Copilot agents working in this repository. Please review these instructions before modifying any code.
