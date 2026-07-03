---
applyTo: "**/*.*"
---

# Instructions - Critical Rules

## 🚨 MANDATORY RULES - NEVER VIOLATE THESE

### 1. Framework Version Compatibility
**ALWAYS verify framework and library versions before using features.**

- Check project dependencies and target framework versions
- DO NOT use language features, APIs, or methods not supported by the installed version
- Verify NuGet package versions before suggesting package-specific features
- When uncertain about version compatibility, check project files first

### 2. Async/Await Best Practices
**NEVER use `.Result` or `.Wait()` to block on async operations.**

- ✅ **DO** use `await` for all async operations
- ❌ **NEVER** use `.Result` to block and wait for a Task
- ❌ **NEVER** use `.Wait()` to block the calling thread
- Use `async/await` all the way through the call stack
- Blocking on async code can cause deadlocks and performance issues

### 3. Security - Authentication & Authorization
**ALL endpoints MUST enforce authentication and authorization.**

- ❌ **NEVER** create open/anonymous endpoints without explicit authorization
- ✅ **ALWAYS** add `[Authorize]` attribute to controllers and actions
- ✅ **ALWAYS** enforce role-based or policy-based authorization where appropriate
- If an endpoint truly needs anonymous access, it must be explicitly marked with `[AllowAnonymous]`
- Security is not optional—protect all API surfaces by default

### 4. DateTime and Timestamps
**ALWAYS use UTC with offset for timestamps unless another pattern already exists.  Don't change existing patterns without explicit instruction.**

- Use `DateTimeOffset` instead of `DateTime` for all timestamps
- Store all dates/times in UTC
- Preserve timezone offset information when relevant
- Convert to local time only at the presentation layer
- Avoid timezone-related bugs by standardizing on UTC

### 5. String Concatenation
**Use StringBuilder for significant string concatenation.**

- ✅ **DO** use `StringBuilder` when concatenating strings in loops
- ✅ **DO** use `StringBuilder` when building large strings (>3-4 concatenations)
- ✅ **DO** use string interpolation for simple, one-time concatenations
- ❌ **DON'T** use `+` operator for multiple string concatenations in loops
- Performance matters—StringBuilder prevents excessive memory allocations

### 6. Code Organization
**Organize code by feature and function, not by type.**

- Use **feature-based folder structure** (vertical slicing)
- Group related functionality together (controllers, services, models for a feature)
- Avoid organizing solely by technical layer (all controllers in one folder, all services in another)
- Related code should live together for better maintainability and discoverability

## ⚠️ Before Committing Code

Ask yourself:
1. ✅ Are all framework features compatible with installed versions?
2. ✅ Did I use `await` instead of `.Result` or `.Wait()`?
3. ✅ Are all endpoints protected with authentication/authorization?
4. ✅ Did I use `DateTimeOffset` and UTC for timestamps?
5. ✅ Did I use `StringBuilder` for string concatenation in loops?
6. ✅ Is code organized by feature rather than by technical type?

## 🔍 Code Review Checklist

Critical violations to check for:
- ❌ Use of `.Result` or `.Wait()` on Tasks
- ❌ Controllers or endpoints without `[Authorize]` attribute
- ❌ Use of `DateTime` instead of `DateTimeOffset`
- ❌ String concatenation with `+` in loops
- ❌ Framework features not supported by project version
- ❌ Code organized by type instead of feature

---

> **Remember:** These are non-negotiable rules. Violations can cause security issues, performance problems, deadlocks, or runtime errors.

> This file is intended for all contributors and Copilot agents working in this repository. These rules must be followed without exception.
