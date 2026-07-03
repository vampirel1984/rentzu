---
applyTo: "**/*.cs"
---

# Consolidated API Standards for AI Coding Agents

> **Purpose**: This document provides consolidated API standards optimized for AI coding agents and LLM prompts. It combines domain-specific API standards into actionable rules and patterns for automated code generation.

---

## 🎯 AI Agent Core Rules

### MANDATORY IMPLEMENTATION PATTERNS

```typescript
// Route Pattern: Always use this structure
/{version}/{resource}/{identifier?}/{subresource?}

// Examples:
// /api/v2/employees
// /api/v2/employees/{employeeId}  
// /api/v2/employees/{employeeId}/certifications/{certId}
```

### HTTP VERB RULES (Enforce Always)
- **GET**: Retrieve resources (idempotent)
- **POST**: Create new resources  
- **PUT**: Replace entire resource (idempotent)
- **PATCH**: Update partial resource (idempotent)
- **DELETE**: Remove resource (idempotent)


### CACHING STRATEGY RULES
- Never allow the result of an API to be cached by any end or intermediate device.

---

## 🌐 Content Negotiation & Media Types

### CONTENT NEGOTIATION RULES
- **Default**: `application/json` when no Accept header provided
- **Supported**: `application/json`, `application/xml`, `text/csv` (for exports)
- **Unsupported Media Type**: Return `406 Not Acceptable`
- **Character Encoding**: Always UTF-8

---

## 🔧 Code Generation Templates

### 1. STANDARD ERROR RESPONSE (Always use this structure)

```json
{
  "correlationId": "{{Generate GUID}}",
  "status": "{{HTTP Status as string}}",
  "title": "{{Short error title}}",
  "detail": "{{Detailed description}}",
  "source": {
    "{{property.path}}": "{{validation message}}",
    "{{array[index].property}}": "{{array validation message}}"
  }
}
```

**AI Agent Rule**: Return this structure for ALL 4xx responses.  Do not return details for 5xx responses and ensure sensitive data such as stack traces and exception details are not returned.

### 2. PAGINATION PATTERN (Implement when returning collections)

**Query Parameters:**
```
?page=1&pageSize=20&sort=lastName,-createdDate&objectSize=medium
```


**AI Agent Rules:**
- `pageSize` max = 100
- Default `objectSize` = "large"
- Sort: comma-separated, `-` prefix for descending

### 3. RESOURCE DESIGN PATTERN

```json
{
  "id": "{{GUID - always use GUIDs}}",
  "{{businessProperty}}": "{{meaningful value, not codes}}",
  "{{relatedObject}}": {
    "id": "{{GUID}}",
    "description": "{{human readable}}",
    "link": "{{HATEOAS link to full resource}}"
  },
  "links": {
    "self": { "href": "/api/v2/resource/{{id}}" },
    "parent": { "href": "/api/v2/parent/{{parentId}}" }
  }
}
```

**AI Agent Rules:**
- Always use business objects, not database tables
- Include meaningful descriptions, not just codes
- Maximum 3 levels of nesting as a general guideline

---

## 🛡️ Security Implementation Rules

### AUTHENTICATION PATTERN (Required for all endpoints)
- Every endpoint MUST be protected by both authentication and privilege checks
- Endpoints checking employee-level data must enforce row-level security
- Endpoints returning any form of client data should not merely check the presence of a privilege, but must also enforce the user has the privilege for the client

```csharp
[Authorize]
[RequirePrivilege("Employee.View")] // Specific privilege, not generic
public async Task<IActionResult> GetEmployee(Guid employeeId)
{
    // Implementation here
}
```

### PII HANDLING RULES
- **List endpoints**: NEVER return PII
- **Single resource**: Return PII only with `?includeSensitiveData=true`
- **Always audit**: When PII is returned, log the access
- TODO:  Provide examples here

```csharp
// Example implementation
public async Task<Employee> GetEmployee(Guid id, bool includeSensitiveData = false)
{
    var employee = await _repository.GetEmployeeAsync(id);
    
    if (!includeSensitiveData)
    {
        employee.SocialSecurityNumber = null;
        employee.BankAccountNumber = null;
    }
    else
    {
        // Log PII access for audit
        _auditService.LogPIIAccess(userId, "Employee.SSN.Access", id);
    }
    
    return employee;
}
```

---

## ⚡ Performance

### PERFORMANCE OPTIMIZATION RULES
- **Response Time Target**: < 200ms for simple queries, < 2s for complex operations
- **Payload Size Limit**: 10MB max request body, 50MB max response
- **Connection Pooling**: Always use HttpClientFactory
- **Async/Await**: All I/O operations must be async
- **Database Queries**: Use pagination, limit N+1 queries

### BULK OPERATIONS PATTERN
```csharp
[HttpPost("bulk-operations")]
[RequestSizeLimit(52428800)] // 50MB limit
public async Task<ActionResult<BulkOperationResult>> BulkOperation(
    [FromBody] BulkOperationRequest request)
{
    // Validate batch size
    if (request.Items.Count > 1000)
        return BadRequest("Maximum 1000 items per batch");
    
    // Process in chunks to avoid timeouts
    var chunks = request.Items.Chunk(100);
    var results = new List<BulkItemResult>();
    
    foreach (var chunk in chunks)
    {
        var chunkResults = await ProcessChunkAsync(chunk);
        results.AddRange(chunkResults);
        
        // Yield control to avoid blocking
        await Task.Yield();
    }
    
    return Ok(new BulkOperationResult { Items = results });
}
```

---

## 📊 HTTP Status Code Decision Tree

```
Success Cases:
├── 200 OK → GET/PUT/PATCH/DELETE success
├── 201 Created → POST creates resource (+ Location header)
├── 202 Accepted → Async operation started
└── 204 No Content → Successful DELETE

Client Errors:
├── 400 Bad Request → Malformed request/validation errors
├── 401 Unauthorized → Authentication failed
├── 403 Forbidden → Authenticated but no permission
├── 404 Not Found → Resource doesn't exist
├── 405 Method Not Allowed → HTTP verb not supported
├── 409 Conflict → Resource conflict
├── 422 Unprocessable Entity → Semantic validation error
└── 429 Too Many Requests → Rate limited

Server Errors:
└── 500 Internal Server Error → Unhandled exception
```

**AI Agent Rule**: Always return the error object structure for 4xx codes.

---

## �️ Data Validation & Serialization

### INPUT VALIDATION RULES
```csharp
public class CreateEmployeeRequest
{
    [Required(ErrorMessage = "First name is required")]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "First name must be 1-50 characters")]
    [RegularExpression(@"^[a-zA-Z\s'-]+$", ErrorMessage = "Invalid characters in first name")]
    public string FirstName { get; set; }
    
    [Required]
    [EmailAddress]
    public string Email { get; set; }
    
    [Range(18, 120, ErrorMessage = "Age must be between 18 and 120")]
    public int Age { get; set; }
    
    [Phone]
    public string PhoneNumber { get; set; }
    
    // Custom validation
    [ValidateObject]
    public Address HomeAddress { get; set; }
}

// Custom validation attribute
public class ValidateObjectAttribute : ValidationAttribute
{
    public override bool IsValid(object value)
    {
        if (value == null) return true;
        
        var validationContext = new ValidationContext(value);
        var results = new List<ValidationResult>();
        return Validator.TryValidateObject(value, validationContext, results, true);
    }
}
```

## �🔄 Query Parameter Standards

### FILTERING
- Use query strings for non-sensitive data
```
/api/v2/employees?clientId=123&department=IT&status=Active
```
- If an endpoint accepts sensitive data to filter such as name or SSN, it should be implemented as a POST with the filter data sent in the request body

### SORTING 
```
/api/v2/employees?sort=lastName,-hireDate,firstName
```

### PAGINATION
```
/api/v2/employees?page=2&pageSize=25
```

### OBJECT SIZE CONTROL
```
/api/v2/employees?objectSize=small  // Options: small, medium, large
```

### SPECIAL FLAGS
```
/api/v2/employees/{id}?includeSensitiveData=true&includeUid=true
```

---

## 🚀 AI Agent Prompt Optimization

### When generating API code, ALWAYS:

1. **Route Structure**: Use versioned routes
2. **Error Handling**: Return standard error object for all errors
3. **Security**: Add authentication and specific privilege checks
4. **PII Protection**: Never return sensitive data in lists
5. **Logging**: Log errors with correlation IDs
6. **Validation**: Validate all inputs and return structured errors
7. **Documentation**: Generate OpenAPI/Swagger annotations

### Code Generation Checklist:
**Core API Design:**
- [ ] Uses GUID identifiers
- [ ] Implements proper HTTP status codes
- [ ] Includes standardized error response structure
- [ ] Has pagination for collections with Link headers
- [ ] Uses business objects (not DB entities)
- [ ] Includes HATEOAS links

**Security & Data Protection:**
- [ ] Protects PII appropriately with conditional access
- [ ] Includes security attributes and privilege checks
- [ ] Implements input validation and sanitization
- [ ] Handles authentication and authorization correctly

**Performance & Scalability:**
- [ ] Has appropriate cache headers and ETag support
- [ ] Implements rate limiting
- [ ] Uses async/await for all I/O operations
- [ ] Includes bulk operation support for large datasets
- [ ] Implements proper connection pooling

**Observability & Monitoring:**
- [ ] Implements proper logging with correlation IDs
- [ ] Includes telemetry and metrics collection
- [ ] Has distributed tracing support
- [ ] Implements health check endpoints

**API Quality & Maintenance:**
- [ ] Supports content negotiation (JSON, XML)
- [ ] Implements proper versioning strategy
- [ ] Includes comprehensive automated tests
- [ ] Has OpenAPI documentation
- [ ] Follows backward compatibility rules
- [ ] Implements circuit breaker pattern for external calls

---

## 🎯 Final AI Agent Rules

1. **Always validate** request models and return structured errors
2. **Never expose** database exceptions or internal details
3. **Use GUIDs** for all resource identifiers
4. **Implement** proper logging with correlation IDs
5. **Include** security attributes on all endpoints
6. **Return** business objects, not database entities
7. **Support** all standard query parameters (paging, sorting, filtering)
8. **Document** everything with OpenAPI annotations

```

### TESTING CHECKLIST FOR AI AGENTS
- [ ] **Happy Path Tests**: All CRUD operations work correctly
- [ ] **Error Handling**: All error responses return standard error format
- [ ] **Validation Tests**: Invalid inputs return 400 with detailed errors
- [ ] **Security Tests**: Unauthorized access returns 401/403
- [ ] **Performance Tests**: Response times meet SLA requirements
- [ ] **Contract Tests**: Responses match OpenAPI schema
- [ ] **Integration Tests**: External dependencies handled correctly
- [ ] **Edge Cases**: Boundary conditions tested (empty lists, null values)

---


## 🔄 API Versioning & Backward Compatibility

### VERSIONING STRATEGY
```csharp
// URL Versioning (Preferred)
[Route("api/v1/[controller]")]
public class EmployeesV1Controller : ControllerBase { }

[Route("api/v2/[controller]")]
public class EmployeesV2Controller : ControllerBase { }
```

### BACKWARD COMPATIBILITY RULES
1. **Additive Changes**: New optional fields, new endpoints ✅
2. **Breaking Changes**: Require new version ❌
   - Removing fields
   - Changing field types
   - Changing response structure
   - Modifying required fields
3. **Deprecation Process**:
   - Announce deprecation 6 months before removal
   - Add deprecation warnings in response headers
   - Provide migration guide

```csharp
// Deprecation warning example
[HttpGet]
[Obsolete("This endpoint is deprecated. Use /api/v2/employees instead.")]
public async Task<IActionResult> GetEmployeesV1()
{
    Response.Headers.Add("Deprecation", "true");
    Response.Headers.Add("Sunset", "2024-12-31");
    Response.Headers.Add("Link", "</api/v2/employees>; rel=\"successor-version\"");
    
    // Implementation
}
```


---

## 🎯 Enhanced AI Agent Rules

This consolidated standard provides all the patterns and rules needed for AI agents to generate consistent, secure, and maintainable APIs that follow enterprise-grade conventions.