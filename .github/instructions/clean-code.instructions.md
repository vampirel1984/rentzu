---
applyTo: "**/*.*"
---

# Instructions - Clean Code Standards

## 🎯 Core Principles

### DRY (Don't Repeat Yourself)
- **NEVER duplicate logic** across multiple locations
- Extract repeated code into reusable methods, classes, or modules
- Identify patterns and create abstractions when code appears more than twice
- Use inheritance, composition, or utility functions to eliminate redundancy

### Single Responsibility Principle (SRP)
- Each class should have **ONE reason to change**
- Each method should do **ONE thing well**
- Split large classes into smaller, focused components
- Separate business logic from data access, presentation, and infrastructure concerns

### Open/Closed Principle (OCP)
- Design entities that are **open for extension, closed for modification**
- Use interfaces, abstract classes, and polymorphism for extensibility
- Avoid modifying existing working code when adding new features
- Leverage design patterns like Strategy, Factory, and Decorator

### Liskov Substitution Principle (LSP)
- Subtypes must be **substitutable for their base types** without breaking functionality
- Derived classes should extend, not replace or weaken, base class behavior
- Avoid throwing unexpected exceptions in overridden methods

### Interface Segregation Principle (ISP)
- **No client should depend on methods it doesn't use**
- Create focused, specific interfaces rather than large, general ones
- Split fat interfaces into smaller, cohesive contracts

### Dependency Inversion Principle (DIP)
- Depend on **abstractions, not concretions**
- High-level modules should not depend on low-level modules
- Use dependency injection to decouple components

## 🏗️ Code Organization

### Separation of Concerns
- **Separate business logic** from infrastructure (database, file system, external APIs)
- Keep presentation logic separate from business rules
- Use layers or modules to organize code by responsibility
- Avoid mixing cross-cutting concerns within domain logic

### Modularity
- Design self-contained, loosely coupled modules
- Each module should have a clear, well-defined purpose
- Minimize dependencies between modules
- Use clear interfaces to define module boundaries

### Cohesion
- Group related functionality together
- Ensure class members work toward a common purpose
- High cohesion within modules, low coupling between modules

## ✨ Code Quality

### Readability
- Write **self-documenting code** with clear, descriptive names
- Keep methods short and focused (ideally < 20 lines)
- Use meaningful variable and function names that reveal intent
- Avoid deep nesting (max 3-4 levels)
- Prefer clarity over cleverness

### Maintainability
- Write code that's **easy to understand and modify**
- Add comments only when necessary to explain "why", not "what"
- Keep complexity low (avoid cyclomatic complexity > 10)

### Testability
- Write code that's **easy to test**
- Avoid tight coupling and hidden dependencies
- Use dependency injection for external dependencies
- Design for mockability and isolation

### Error Handling
- Handle errors gracefully and consistently
- Use exceptions for exceptional cases, not control flow
- Provide meaningful error messages
- Clean up resources properly (use `using` statements in C#)

## 🎨 Frontend Code Standards

### Component Design (React/Frontend)
- **Keep components small and focused** (ideally < 200 lines)
- Each component should have a **single, clear purpose**
- Extract complex rendering logic into smaller sub-components
- Use proper component hierarchy and composition

### Component Scope
- **Avoid "god components"** that render entire pages with complex logic
- Break down large components into presentation and container components
- Extract reusable UI patterns into shared components
- Keep component responsibilities narrow and well-defined

### Rendering Logic
- **Minimize conditional rendering complexity** within a single component
- Extract complex conditional UI into separate components
- Avoid deeply nested ternary operators (max 1-2 levels)
- Use early returns or guard clauses to reduce nesting

### State Management
- Keep component state **minimal and focused**
- Lift state up only when necessary for sharing
- Use custom hooks to extract complex stateful logic
- Avoid prop drilling—use context or state management libraries when appropriate

### Hooks and Logic Extraction
- Extract complex logic into **custom hooks**
- Keep hooks focused on a single concern
- Separate business logic from UI logic
- Reuse hooks across components when patterns emerge

### Component Organization
- Group related components in feature-based folders
- Separate presentational components from business logic components
- Use clear, descriptive component names that reflect their purpose
- Keep component files focused—one component per file (except for small, tightly coupled sub-components)

## 🔍 Code Review Checklist

Before considering code complete, verify:
- ✅ No duplicate code exists
- ✅ Each class/method has a single, clear responsibility
- ✅ Code is organized into logical layers/modules
- ✅ Dependencies point toward abstractions
- ✅ Names are clear and reveal intent
- ✅ Methods are small and focused
- ✅ Code is easily testable
- ✅ SOLID principles are followed
- ✅ Frontend components are properly scoped and not overly complex
- ✅ Rendering logic is extracted into focused sub-components

## 🚫 Common Anti-Patterns to Avoid

### General Anti-Patterns
- **God Classes**: Classes that know/do too much
- **Feature Envy**: Methods that access data from other objects more than their own
- **Primitive Obsession**: Overuse of primitives instead of small objects for simple tasks
- **Long Parameter Lists**: Methods with more than 3-4 parameters
- **Switch Statements on Type**: Use polymorphism instead
- **Shotgun Surgery**: Single change requires modifications in many places

### Frontend Anti-Patterns
- **Monolithic Components**: Large components with hundreds of lines and multiple responsibilities
- **Prop Drilling**: Passing props through many layers—use context or state management instead
- **Inline Complex Logic**: Business logic mixed with JSX rendering
- **Overly Nested JSX**: Deep nesting that makes components hard to read
- **Hook Overload**: Too many hooks in a single component—extract into custom hooks

---

> **Remember:** Clean code is not about perfection—it's about clarity, maintainability, and respect for future developers (including yourself).

> This file is intended for all contributors and Copilot agents working in this repository. Please review these instructions before writing any code.
