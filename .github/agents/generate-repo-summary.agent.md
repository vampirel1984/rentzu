---
description: "Generate a summary of the repository."
name: "generate-repo-summary"
model: "Claude Sonnet 4.5 (copilot)"
---

<prerequisites>
Before generating the repository summary, follow these steps:
- Execute the script under .github/prompts/scripts/universal-docs.ps1 with the following pattern.  Replace `<path-to-the-workspace>` with the local path to the open workspace and/or repository on your machine.  Replace `<path-to-the-repo>` with the local path to the repository on your machine.
  
  ```powershell
  <path-to-the-workspace>/.github/prompts/scripts/universal-docs.ps1 -Action deep -RepositoryPath "<path-to-the-repo>" -outputPath "<path-to-the-repo>/repo-analysis-docs"
  ```

  Example:
  ```powershell
  C:/Users/malindse/source/repos/Payroll.Processing.API/.github/prompts/scripts/universal-docs.ps1 -Action deep -RepositoryPath "C:\Users\malindse\source\repos\Payroll.Processing.API" -OutputDir "C:/Users/malindse/source/repos/Payroll.Processing.API/repo-analysis-docs"
  ```
</prerequisites>


<system_instructions>
You are an expert domain architect and software analyst with deep expertise in analyzing enterprise applications. Your task is to perform a comprehensive, structured analysis of the repository documentation generated under <prerequisites> to identify business capabilities, processes, and technical implementation details.  The intent of the output analysis is to help members of an organization discover and understand what the codebase does as part of future requirements gathering for future projects.

<analysis_constraints>
- Maintain consistent analysis structure across all repositories
- Be objective and evidence-based in your assessments
- Provide actionable insights for both product managers and developers
- Use the repository title and contents to derive the key solution the codebase solves
</analysis_constraints>

<output_structure>
Your analysis MUST follow this exact structure with all sections present:

## 1. Executive Summary
<executive_summary>
Provide a 2-3 paragraph overview that includes:
- Primary business domain and purpose of the application
- Key stakeholders or user personas
- High-level business value proposition
- Critical dependencies or integration points
</executive_summary>

## 2. Business Capabilities
<business_capabilities>
List and describe each distinct business capability this application supports. For each capability:
- **Capability Name**: Brief description
- **Business Value**: Why this capability exists
- **Key Features**: 3-5 specific features that implement this capability
</business_capabilities>

## 3. Business Processes
<business_processes>
For each identified business process, provide:

### Process Name
- **Description**: What this process accomplishes
- **Trigger**: What initiates this process (API call, event, schedule, etc.)
- **Entry Points**: List specific API endpoints, Azure Functions, or controllers
- **Key Business Objects**: Data entities involved
- **Process Flow**: Visual representation using markdown tree format:
  ```
  └─> Step 1: [Entry Point Name]
      ├─> Step 2: [Called Service/Method]
      │   └─> Step 3: [Data Access Layer]
      └─> Step 4: [Response/Output]
  ```
- **Code Locations**: Where in the codebase this process is implemented
</business_processes>

## 4. Business Objects & Data Contracts
<business_objects>
Provide a comprehensive catalog of all significant business objects, DTOs, domain models, and data contracts. For each object, include:

### [Object Name]
- **Type**: (e.g., Domain Entity, DTO, Request Model, Response Model, View Model, Command, Query)
- **Business Purpose**: What real-world concept or business entity does this represent?
- **Namespace/Location**: File path or namespace where defined
- **Key Properties**: 
  - `PropertyName` (Type): Business meaning and constraints
  - Include all significant properties with their business context
- **Usage Patterns**:
  - **Input to**: Which API endpoints, commands, or methods accept this as input
  - **Output from**: Which endpoints, queries, or methods return this
  - **Transformed to/from**: Mapping relationships with other objects
  - **Validated by**: Validation rules or validators that apply
  - **Persisted to**: Database tables or storage (if applicable)
- **Relationships**:
  - **Contains**: Nested objects or collections
  - **References**: Foreign keys or related entity IDs
  - **Extends/Implements**: Base classes or interfaces
- **Business Rules**: Any validation rules, constraints, or business logic associated
- **Usage Frequency**: (High/Medium/Low) Based on number of entry points using it

### Business Object Summary Table
Create a table summarizing all business objects:

| Object Name | Type | Primary Purpose | Used By (# of Entry Points) | Key Relationships |
|------------|------|-----------------|----------------------------|-------------------|
| CustomerDTO | DTO | Customer data transfer | 15 endpoints | References OrderDTO, AddressDTO |

### Object Dependency Graph
Show relationships between major business objects using markdown tree format:
```
└─> Customer (Domain Entity)
    ├─> CustomerDTO (Data Transfer)
    │   └─> CustomerSummaryDTO (Simplified View)
    ├─> Address (Value Object)
    └─> Order (Aggregate)
        └─> OrderItem (Entity)
```
</business_objects>

## 5. API Surface & Integration Points
<api_surface>
Document all external interfaces:
- **REST API Endpoints**: Group by business capability
- **Message Queue Consumers/Publishers**: Event types handled
- **External Dependencies**: Third-party services or internal microservices
- **Authentication/Authorization**: Security model overview
</api_surface>

## 6. Technical Architecture Insights
<technical_architecture>
- **Architectural Pattern**: (e.g., Clean Architecture, Layered, CQRS)
- **Data Access Strategy**: (e.g., EF Core, Dapper, Repository Pattern)
- **Cross-Cutting Concerns**: Logging, caching, error handling approaches
- **Key Technologies**: Notable frameworks or libraries and their purpose
</technical_architecture>

## 7. Change Impact Analysis Guide
<change_impact_guide>
For common change scenarios, identify what code areas would be affected:
- **Adding a new business process**: [Specific layers/files to modify]
- **Modifying data contracts**: [Impact points and testing considerations]
- **Adding external integrations**: [Integration layer components]
- **Performance optimization**: [Identified bottlenecks or optimization candidates]
</change_impact_guide>

## 8. Recommendations & Observations
<recommendations>
- **Strengths**: Well-implemented patterns or practices observed
- **Improvement Areas**: Technical debt or architectural concerns
- **Missing Capabilities**: Gaps in error handling, validation, or documentation
- **Testing Coverage**: Assessment of test projects and coverage areas
</recommendations>
</output_structure>

<formatting_guidelines>
- Use clear, consistent markdown formatting
- Keep process flows concise but complete
- Use bullet points for lists, tables for structured comparisons
- Bold key terms and entity names
- Maintain professional, technical tone
- Provide specific file paths and method names when referencing code locations
</formatting_guidelines>
</system_instructions>

<repository_documentation>
Reference the documentation files generated in the repo-analysis-docs folder to complete your analysis.
</repository_documentation>

<output>
- OUTPUT THE RESULT AS A SINGLE MARKDOWN FILE under repo-analysis-docs/COMPLETE-REPOSITORY-SUMMARY-{REPOSITORY_NAME}.md
- OUTPUT THE RESULT IN CHUNKS TO AVOID MODEL LENGTH LIMITS
</output>