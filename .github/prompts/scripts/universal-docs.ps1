#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Universal Repository Documentation Suite

.DESCRIPTION
    Master script for generating comprehensive documentation for ANY repository.
    Supports .NET, Node.js, Python, Java, and other project types.
    Works completely offline without external dependencies.

.PARAMETER Action
    What type of documentation to generate:
    - 'analyze' (default): Interactive menu
    - 'full': Complete detailed instructions  
    - 'quick': Quick start guide
    - 'json': JSON analysis export
    - 'business-logic': Trace business logic flows and entry points
    - 'dtos': Extract DTOs and key classes
    - 'tags': Generate intelligent tags
    - 'deep': Complete deep analysis (all formats + business logic + DTOs + tags)
    - 'all': Generate all basic formats (full + quick + json)
    - 'clean': Remove generated files

.PARAMETER RepositoryPath
    Path to repository (defaults to current directory)

.PARAMETER OutputDir
    Directory for output files (defaults to repository root)

.EXAMPLE
    .\universal-docs.ps1                              # Interactive menu
    .\universal-docs.ps1 -Action full                 # Full documentation
    .\universal-docs.ps1 -Action quick                # Quick start only  
    .\universal-docs.ps1 -Action business-logic       # Business logic analysis
    .\universal-docs.ps1 -Action dtos                 # DTO extraction
    .\universal-docs.ps1 -Action tags                 # Tag generation
    .\universal-docs.ps1 -Action deep                 # Complete deep analysis
    .\universal-docs.ps1 -Action all                  # All basic formats
    .\universal-docs.ps1 -RepositoryPath "C:\MyRepo"  # Analyze different repo
#>

param(
    [ValidateSet('analyze', 'full', 'quick', 'json', 'all', 'business-logic', 'dtos', 'tags', 'deep', 'clean')]
    [string]$Action = 'analyze',
    [string]$RepositoryPath = ".",
    [string]$OutputDir = ""
)

# Resolve paths
$RepositoryPath = Resolve-Path $RepositoryPath
$repoName = Split-Path $RepositoryPath -Leaf

if (-not $OutputDir) {
    $OutputDir = $RepositoryPath
}

# Change to the target repository for analysis
Push-Location $RepositoryPath

function Show-UniversalBanner {
    Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║               Universal Repository Documentation               ║
║                                                                ║
║  Automatically analyze and document ANY code repository       ║
║  Supports: .NET • Node.js • Python • Java • and more!        ║
║  Works offline - no external services required                ║
╚════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan
}

function Show-UniversalMenu {
    Write-Host "`n Choose Documentation Type:" -ForegroundColor Yellow
    Write-Host "  1. Full Documentation     - Comprehensive analysis with detailed setup"
    Write-Host "  2. Quick Start Guide      - Essential setup steps and commands"
    Write-Host "  3. JSON Analysis          - Machine-readable analysis data"
    Write-Host "  4. Business Logic Flow    - Trace entry points and data flows (.NET)"
    Write-Host "  5. DTO & Class Catalog    - Extract all DTOs and key classes (.NET)"
    Write-Host "  6. React Analysis         - Components, hooks, and flows (React)"
    Write-Host "  7. Generate Tags          - Intelligent tag generation"
    Write-Host "  8. Complete Deep Analysis - All formats + project-specific analysis"
    Write-Host "  9. Show Current Files     - List existing documentation"
    Write-Host " 10. Clean Up               - Remove generated documentation"
    Write-Host " 11. Change Repository      - Analyze a different repository"
    Write-Host " 12. Exit"
    Write-Host ""
}

function Get-UserChoice {
    do {
        $choice = Read-Host "Enter your choice (1-12)"
    } while ($choice -notmatch '^([1-9]|1[0-2])$')
    return [int]$choice
}

function Get-RepositoryPath {
    do {
        $path = Read-Host "Enter repository path (or press Enter for current directory)"
        if (-not $path) { $path = "." }
        
        if (Test-Path $path) {
            return Resolve-Path $path
        } else {
            Write-Host "Path not found: $path" -ForegroundColor Red
        }
    } while ($true)
}

function Invoke-UniversalFullGeneration {
    Write-Host "🔄 Generating comprehensive documentation..." -ForegroundColor Green
    
    $fullScript = Join-Path $PSScriptRoot "generate-universal-docs.ps1"
    if (Test-Path $fullScript) {
        & $fullScript -RepositoryPath $RepositoryPath -OutputFile (Join-Path $OutputDir "REPOSITORY_INSTRUCTIONS.md") -JsonOutput
    } else {
        Write-Host "❌ generate-universal-docs.ps1 not found in script directory!" -ForegroundColor Red
        Write-Host "   Please ensure all scripts are in the same directory." -ForegroundColor Yellow
    }
}

function Invoke-UniversalQuickGeneration {
    Write-Host "🔄 Generating quick start guide..." -ForegroundColor Green
    
    $quickScript = Join-Path $PSScriptRoot "fast-repo-analyzer.ps1"
    if (Test-Path $quickScript) {
        & $quickScript -Format both -RepositoryPath $RepositoryPath -OutputFile (Join-Path $OutputDir "QUICK_START")
    } else {
        # Fallback to original script
        $fallbackScript = Join-Path $PSScriptRoot "universal-quick-docs.ps1"
        if (Test-Path $fallbackScript) {
            & $fallbackScript -RepositoryPath $RepositoryPath -OutputFile (Join-Path $OutputDir "QUICK_START.md")
        } else {
            Write-Host "❌ No quick documentation script found!" -ForegroundColor Red
        }
    }
}

function Invoke-UniversalJsonGeneration {
    Write-Host "🔄 Generating JSON analysis..." -ForegroundColor Green
    
    $quickScript = Join-Path $PSScriptRoot "fast-repo-analyzer.ps1"
    if (Test-Path $quickScript) {
        & $quickScript -Format json -RepositoryPath $RepositoryPath -OutputFile (Join-Path $OutputDir "repo-analysis")
    } else {
        # Fallback to original script
        $fallbackScript = Join-Path $PSScriptRoot "universal-quick-docs.ps1"
        if (Test-Path $fallbackScript) {
            & $fallbackScript -Format json -RepositoryPath $RepositoryPath -OutputFile (Join-Path $OutputDir "repo-analysis.json")
        } else {
            Write-Host "❌ No JSON analysis script found!" -ForegroundColor Red
        }
    }
}

function Invoke-BusinessLogicAnalysis {
    Write-Host "🔄 Analyzing business logic flows..." -ForegroundColor Green
    
    $logicScript = Join-Path $PSScriptRoot "Analyze-BusinessLogic.ps1"
    if (Test-Path $logicScript) {
        $analysis = & $logicScript -RepositoryPath $RepositoryPath
        
        # Save results
        $jsonOutput = Join-Path $OutputDir "BUSINESS_LOGIC_FLOWS.json"
        $analysis | ConvertTo-Json -Depth 10 | Set-Content $jsonOutput
        
        # Generate markdown report
        $mdOutput = Join-Path $OutputDir "BUSINESS_LOGIC_FLOWS.md"
        Format-BusinessLogicReport -Analysis $analysis -OutputFile $mdOutput
        
        Write-Host "✅ Business logic analysis saved to:" -ForegroundColor Green
        Write-Host "   $jsonOutput" -ForegroundColor Gray
        Write-Host "   $mdOutput" -ForegroundColor Gray
    } else {
        Write-Host "❌ Analyze-BusinessLogic.ps1 not found!" -ForegroundColor Red
        Write-Host "   Please ensure all scripts are in the same directory." -ForegroundColor Yellow
    }
}

function Invoke-DTOExtraction {
    Write-Host "🔄 Extracting DTOs and key classes..." -ForegroundColor Green
    
    $dtoScript = Join-Path $PSScriptRoot "Extract-DTOsAndClasses.ps1"
    if (Test-Path $dtoScript) {
        $analysis = & $dtoScript -RepositoryPath $RepositoryPath
        
        # Save results
        $jsonOutput = Join-Path $OutputDir "CLASS_CATALOG.json"
        $analysis | ConvertTo-Json -Depth 10 | Set-Content $jsonOutput
        
        # Generate markdown catalog
        $mdOutput = Join-Path $OutputDir "CLASS_CATALOG.md"
        Format-ClassCatalog -Analysis $analysis -OutputFile $mdOutput
        
        Write-Host "✅ Class catalog saved to:" -ForegroundColor Green
        Write-Host "   $jsonOutput" -ForegroundColor Gray
        Write-Host "   $mdOutput" -ForegroundColor Gray
    } else {
        Write-Host "❌ Extract-DTOsAndClasses.ps1 not found!" -ForegroundColor Red
        Write-Host "   Please ensure all scripts are in the same directory." -ForegroundColor Yellow
    }
}

function Invoke-TagGeneration {
    Write-Host "🔄 Generating intelligent tags..." -ForegroundColor Green
    
    $tagScript = Join-Path $PSScriptRoot "Generate-RepositoryTags.ps1"
    if (Test-Path $tagScript) {
        $analysis = & $tagScript -RepositoryPath $RepositoryPath
        
        # Save results
        $jsonOutput = Join-Path $OutputDir "REPOSITORY_TAGS.json"
        $analysis | ConvertTo-Json -Depth 10 | Set-Content $jsonOutput
        
        # Generate markdown report
        $mdOutput = Join-Path $OutputDir "REPOSITORY_TAGS.md"
        Format-TagReport -Analysis $analysis -OutputFile $mdOutput
        
        Write-Host "✅ Tags saved to:" -ForegroundColor Green
        Write-Host "   $jsonOutput" -ForegroundColor Gray
        Write-Host "   $mdOutput" -ForegroundColor Gray
    } else {
        Write-Host "❌ Generate-RepositoryTags.ps1 not found!" -ForegroundColor Red
        Write-Host "   Please ensure all scripts are in the same directory." -ForegroundColor Yellow
    }
}

function Invoke-ReactAnalysis {
    Write-Host "🔄 Analyzing React application..." -ForegroundColor Green
    
    $reactScript = Join-Path $PSScriptRoot "Analyze-ReactBusinessLogic.ps1"
    if (Test-Path $reactScript) {
        try {
            $analysis = & $reactScript -RepoPath $RepositoryPath
            
            # Save results
            $jsonOutput = Join-Path $OutputDir "REACT_ANALYSIS.json"
            $analysis | ConvertTo-Json -Depth 10 | Set-Content $jsonOutput
            
            # Generate markdown report
            $mdOutput = Join-Path $OutputDir "REACT_ANALYSIS.md"
            Write-Host "   Generating markdown report..." -ForegroundColor Gray
            Format-ReactReport -Analysis $analysis -OutputFile $mdOutput
            
            Write-Host "✅ React analysis saved to:" -ForegroundColor Green
            Write-Host "   $jsonOutput" -ForegroundColor Gray
            Write-Host "   $mdOutput" -ForegroundColor Gray
        } catch {
            Write-Host "❌ Error during React analysis: $_" -ForegroundColor Red
            Write-Host "   Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Analyze-ReactBusinessLogic.ps1 not found!" -ForegroundColor Red
        Write-Host "   Please ensure all scripts are in the same directory." -ForegroundColor Yellow
    }
}

function Format-BusinessLogicReport {
    param($Analysis, $OutputFile)
    
    $output = @()
    $output += "# Business Logic Flow Analysis"
    $output += ""
    $output += "**Repository:** $($Analysis.Repository)  "
    $output += "**Analyzed:** $($Analysis.AnalyzedAt)  "
    $output += ""
    $output += "## Summary"
    $output += ""
    $output += "- **Total Entry Points:** $($Analysis.Statistics.TotalEntryPoints)"
    $output += "- **Controllers:** $($Analysis.EntryPoints.Controllers.Count)"
    $output += "- **Azure Functions:** $($Analysis.EntryPoints.AzureFunctions.Count)"
    $output += "- **Message Handlers:** $($Analysis.EntryPoints.MessageHandlers.Count)"
    $output += "- **Background Jobs:** $($Analysis.EntryPoints.BackgroundJobs.Count)"
    $output += "- **GraphQL Resolvers:** $($Analysis.EntryPoints.GraphQLResolvers.Count)"
    $output += "- **SignalR Hubs:** $($Analysis.EntryPoints.SignalRHubs.Count)"
    $output += "- **gRPC Services:** $($Analysis.EntryPoints.gRPCServices.Count)"
    $output += "- **Minimal Endpoints:** $($Analysis.EntryPoints.Endpoints.Count)"
    $output += "- **Total Data Flows Traced:** $($Analysis.Statistics.TotalDataFlows)"
    $output += "- **Maximum Call Depth:** $($Analysis.Statistics.MaxCallDepth)"
    $output += ""
    
    # Entry Points Details
    if ($Analysis.EntryPoints.Controllers.Count -gt 0) {
        $output += "## Controllers"
        $output += ""
        foreach ($controller in $Analysis.EntryPoints.Controllers) {
            $output += "### $($controller.Name)"
            $output += "**File:** ``$($controller.File)``"
            $output += ""
            $output += "**Endpoints:**"
            foreach ($endpoint in $controller.Endpoints) {
                $output += "- **$($endpoint.HttpVerb)** ``$($endpoint.Route)`` → ``$($endpoint.Method)()`` returns ``$($endpoint.ReturnType)``"
            }
            $output += ""
        }
    }
    
    if ($Analysis.EntryPoints.AzureFunctions.Count -gt 0) {
        $output += "## Azure Functions"
        $output += ""
        foreach ($func in $Analysis.EntryPoints.AzureFunctions) {
            $output += "### $($func.Name)"
            $output += "**File:** ``$($func.File)``  "
            $output += "**Trigger:** $($func.TriggerType)  "
            $output += "**Method:** ``$($func.Method)()``  "
            $output += "**Returns:** ``$($func.ReturnType)``"
            $output += ""
        }
    }
    
    if ($Analysis.EntryPoints.MessageHandlers.Count -gt 0) {
        $output += "## Message Handlers"
        $output += ""
        foreach ($handler in $Analysis.EntryPoints.MessageHandlers) {
            $output += "### $($handler.Name)"
            $output += "**File:** ``$($handler.File)``  "
            $output += "**Type:** $($handler.HandlerType)  "
            $output += "**Message:** ``$($handler.MessageType)``"
            $output += ""
        }
    }
    
    # Modified by AI on 11/03/2025. Edit #1.
    # Data Flows
    if ($Analysis.DataFlows.Count -gt 0) {
        $output += "## Data Flow Traces"
        $output += ""
        $output += "Shows the hierarchical call chains from entry points through the application."
        $output += ""
        
        # Sort by Type (Controller, AzureFunction, MessageHandler) then by EntryPoint name
        # Include all flows, not just first 20
        $sortedFlows = $Analysis.DataFlows | Sort-Object -Property @{Expression={$_.Type}; Ascending=$true}, @{Expression={$_.EntryPoint}; Ascending=$true}
        
        foreach ($flow in $sortedFlows) {
            $output += "### $($flow.EntryPoint)"
            $output += "**Type:** $($flow.Type)"
            if ($flow.Route) { $output += "**Route:** ``$($flow.Route)``" }
            if ($flow.Trigger) { $output += "**Trigger:** $($flow.Trigger)" }
            if ($flow.MessageType) { $output += "**Message:** ``$($flow.MessageType)``" }
            $output += "**Call Depth:** $($flow.Depth)"
            $output += ""
            
            if ($flow.CallChain -and $flow.CallChain.Count -gt 0) {
                $output += "**Call Flow:**"
                $output += "``````"
                $output += $flow.EntryPoint
                
                $callsByDepth = $flow.CallChain | Group-Object -Property Depth | Sort-Object Name
                foreach ($depthGroup in $callsByDepth) {
                    $indent = "  " * ([int]$depthGroup.Name + 1)
                    foreach ($call in $depthGroup.Group) {
                        if ($call.Type -eq "Database") {
                            $output += "$indent└─> [DB] Query/Command"
                        } elseif ($call.Type -eq "HTTP") {
                            $output += "$indent└─> [HTTP] External Service Call"
                        } else {
                            $output += "$indent└─> $($call.To)"
                        }
                    }
                }
                $output += "``````"
            }
            $output += ""
        }
    }
    
    $output -join "`n" | Set-Content $OutputFile
}

function Format-ClassCatalog {
    param($Analysis, $OutputFile)
    
    $output = @()
    $output += "# Class Catalog"
    $output += ""
    $output += "**Repository:** $($Analysis.Repository)  "
    $output += "**Analyzed:** $($Analysis.AnalyzedAt)  "
    $output += "**Total Classes:** $($Analysis.TotalClasses)"
    $output += ""
    $output += "## Category Summary"
    $output += ""
    $output += "| Category | Count |"
    $output += "|----------|-------|"
    
    foreach ($category in ($Analysis.Categories.Keys | Sort-Object)) {
        $count = $Analysis.Categories[$category]
        $output += "| $category | $count |"
    }
    $output += ""
    
    # Key DTOs
    if ($Analysis.GroupedClasses.DTOs.Count -gt 0) {
        $output += "## DTOs ($($Analysis.GroupedClasses.DTOs.Count))"
        $output += ""
        foreach ($dto in ($Analysis.GroupedClasses.DTOs | Sort-Object Name | Select-Object -First 50)) {
            $output += "### $($dto.Name)"
            $output += "**Namespace:** ``$($dto.Namespace)``  "
            $output += "**File:** ``$($dto.File)``"
            
            if ($dto.Properties -and $dto.Properties.Count -gt 0) {
                $output += ""
                $output += "| Property | Type | Required | Nullable |"
                $output += "|----------|------|----------|----------|"
                foreach ($prop in $dto.Properties) {
                    $req = if ($prop.IsRequired) { "✅" } else { "❌" }
                    $null = if ($prop.IsNullable) { "✅" } else { "❌" }
                    $output += "| ``$($prop.Name)`` | ``$($prop.Type)`` | $req | $null |"
                }
            }
            $output += ""
        }
    }
    
    # Entities
    if ($Analysis.GroupedClasses.Entities.Count -gt 0) {
        $output += "## Domain Entities ($($Analysis.GroupedClasses.Entities.Count))"
        $output += ""
        foreach ($entity in ($Analysis.GroupedClasses.Entities | Sort-Object Name | Select-Object -First 30)) {
            $output += "### $($entity.Name)"
            $output += "**Namespace:** ``$($entity.Namespace)``  "
            $output += "**File:** ``$($entity.File)``"
            
            if ($entity.BaseClass) {
                $output += "**Inherits:** ``$($entity.BaseClass)``"
            }
            
            if ($entity.Properties -and $entity.Properties.Count -gt 0) {
                $output += ""
                $output += "**Properties:** " + (($entity.Properties | ForEach-Object { "``$($_.Name)``" }) -join ", ")
            }
            $output += ""
        }
    }
    
    # Services
    if ($Analysis.GroupedClasses.Services.Count -gt 0) {
        $output += "## Services ($($Analysis.GroupedClasses.Services.Count))"
        $output += ""
        foreach ($service in ($Analysis.GroupedClasses.Services | Sort-Object Name)) {
            $output += "- **$($service.Name)** - ``$($service.File)``"
        }
        $output += ""
    }
    
    $output -join "`n" | Set-Content $OutputFile
}

function Format-ReactReport {
    param($Analysis, $OutputFile)
    
    $output = @()
    $output += "# React Application Analysis"
    $output += ""
    $output += "**Repository:** $($Analysis.RepositoryPath)  "
    $output += "**Analyzed:** $($Analysis.AnalysisDate)  "
    $output += ""
    
    # Summary
    $output += "## Summary"
    $output += ""
    
    # Calculate method statistics
    $totalMethods = ($Analysis.Components | ForEach-Object { $_.Methods }).Count
    $totalApiCalls = ($Analysis.Components | ForEach-Object { $_.ApiCalls }).Count
    
    $output += "- **Total Files:** $($Analysis.Statistics.TotalFiles)"
    $output += "- **Total Components:** $($Analysis.Statistics.TotalComponents)"
    $output += "- **Entry Points:** $($Analysis.EntryPoints.Count)"
    $output += "- **Custom Hooks:** $($Analysis.Statistics.TotalHooks)"
    $output += "- **Routes:** $($Analysis.Statistics.TotalRoutes)"
    $output += "- **Total Methods:** $totalMethods"
    $output += "- **Total API Calls:** $totalApiCalls"
    $output += "- **Component Dependencies:** $($Analysis.ComponentDependencies.Count)"
    $output += "- **Max Component Depth:** $($Analysis.Statistics.MaxComponentDepth)"
    $output += ""
    
    # Entry Points
    if ($Analysis.EntryPoints.Count -gt 0) {
        $output += "## Entry Points"
        $output += ""
        foreach ($entry in $Analysis.EntryPoints) {
            $output += "### $($entry.Name)"
            $output += "- **File:** ``$($entry.FilePath)``"
            $output += "- **Type:** $($entry.Type)"
            $output += "- **Export:** $($entry.ExportType)"
            if ($entry.Props.Count -gt 0) {
                $output += "- **Props:** " + (($entry.Props | ForEach-Object { "``$($_.Name): $($_.Type)``" }) -join ", ")
            }
            $output += ""
        }
    }
    
    # Component Hierarchy
    if ($Analysis.ComponentHierarchy -and $Analysis.ComponentHierarchy.Count -gt 0) {
        $output += "## Component Hierarchy"
        $output += ""
        $output += "This tree shows how components import and use each other:"
        $output += ""
        
        function Format-TreeNode {
            param($Node, $Prefix = "", $IsLast = $true)
            
            $lines = @()
            
            # Determine the tree characters
            $connector = if ($IsLast) { "└─" } else { "├─" }
            $extension = if ($IsLast) { "  " } else { "│ " }
            
            # Format component name with file path
            $componentInfo = "**$($Node.Name)** ``$($Node.FilePath)``"
            $lines += "$Prefix$connector $componentInfo"
            
            # Process children
            if ($Node.Children -and $Node.Children.Count -gt 0) {
                $childCount = $Node.Children.Count
                for ($i = 0; $i -lt $childCount; $i++) {
                    $child = $Node.Children[$i]
                    $isLastChild = ($i -eq ($childCount - 1))
                    $childLines = Format-TreeNode -Node $child -Prefix "$Prefix$extension" -IsLast $isLastChild
                    $lines += $childLines
                }
            }
            
            return $lines
        }
        
        # Format each root tree
        foreach ($tree in $Analysis.ComponentHierarchy) {
            $treeLines = Format-TreeNode -Node $tree
            foreach ($line in $treeLines) {
                $output += $line
            }
            $output += ""
        }
    }
    
    # Routes
    if ($Analysis.Routes.Count -gt 0) {
        $output += "## Routes"
        $output += ""
        $output += "| Path | Component |"
        $output += "|------|-----------|"
        foreach ($route in ($Analysis.Routes | Sort-Object Path)) {
            $output += "| ``$($route.Path)`` | ``$($route.Component)`` |"
        }
        $output += ""
    }
    
    # Components
    $output += "## Components"
    $output += ""
    foreach ($component in ($Analysis.Components | Sort-Object Name)) {
        $output += "### $($component.Name)"
        $output += "- **File:** ``$($component.FilePath)``"
        $output += "- **Type:** $($component.Type)"
        $output += "- **Export:** $($component.ExportType)"
        
        if ($component.Props.Count -gt 0) {
            $output += "- **Props:**"
            foreach ($prop in $component.Props) {
                $output += "  - ``$($prop.Name): $($prop.Type)``"
            }
        }
        
        if ($component.State.Count -gt 0) {
            $output += "- **State:** " + (($component.State | ForEach-Object { "``$_``" }) -join ", ")
        }
        
        if ($component.Hooks.Count -gt 0) {
            $output += "- **Hooks Used:** " + (($component.Hooks | Select-Object -Unique -ExpandProperty Hook) -join ", ")
        }
        
        if ($component.Methods.Count -gt 0) {
            $output += "- **Methods ($($component.Methods.Count)):**"
            foreach ($method in ($component.Methods | Sort-Object Line)) {
                $asyncLabel = if ($method.IsAsync) { " [async]" } else { "" }
                $params = if ($method.Parameters) { $method.Parameters } else { "" }
                $callsInfo = if ($method.CallsMethods.Count -gt 0) { 
                    " → Calls: " + (($method.CallsMethods | ForEach-Object { "``$_()``" }) -join ", ")
                } else { "" }
                $output += "  - ``$($method.Name)($params)``$asyncLabel (Line $($method.Line))$callsInfo"
            }
        }
        
        if ($component.ApiCalls.Count -gt 0) {
            $output += "- **API Calls:**"
            
            # Group API calls by type
            $imports = $component.ApiCalls | Where-Object { $_.Type -eq "Import" }
            $serviceCalls = $component.ApiCalls | Where-Object { $_.Type -eq "Service" }
            $directCalls = $component.ApiCalls | Where-Object { $_.Type -ne "Import" -and $_.Type -ne "Service" }
            
            # Show imports first
            if ($imports.Count -gt 0) {
                $output += "  - **API Imports:**"
                foreach ($api in $imports) {
                    $output += "    - ``$($api.Url)`` (Line $($api.Line))"
                }
            }
            
            # Show service method calls
            if ($serviceCalls.Count -gt 0) {
                $output += "  - **Service Calls:**"
                foreach ($api in $serviceCalls) {
                    $output += "    - ``$($api.Method)()`` (Line $($api.Line))"
                }
            }
            
            # Show direct HTTP calls
            if ($directCalls.Count -gt 0) {
                $output += "  - **HTTP Calls:**"
                foreach ($api in $directCalls) {
                    $httpMethod = if ($api.Method) { "[$($api.Method)]" } else { "" }
                    $urlDisplay = if ($api.Url -and $api.Url -ne "Service method") { $api.Url } else { $api.Pattern }
                    $output += "    - $httpMethod ``$($urlDisplay)`` (Line $($api.Line))"
                }
            }
        }
        
        if ($component.BusinessLogicFlows.Count -gt 0) {
            $output += "- **Business Logic:**"
            foreach ($flow in $component.BusinessLogicFlows) {
                $output += "  - ``$($flow.Name)`` - $($flow.Type) (Line $($flow.Line))"
            }
        }
        
        if ($component.ComponentDependencies.Count -gt 0) {
            $output += "- **Dependencies:** " + (($component.ComponentDependencies | ForEach-Object { "``$_``" }) -join ", ")
        }
        
        $output += ""
    }
    
    # API Summary - Aggregate all API calls across components
    $allApiCalls = $Analysis.Components | ForEach-Object { $_.ApiCalls } | Where-Object { $_ -ne $null }
    if ($allApiCalls.Count -gt 0) {
        $output += "## API Summary"
        $output += ""
        
        # API Imports Summary
        $apiImports = $allApiCalls | Where-Object { $_.Type -eq "Import" } | Select-Object -ExpandProperty Url -Unique
        if ($apiImports.Count -gt 0) {
            $output += "### API Service Imports"
            $output += ""
            foreach ($import in ($apiImports | Sort-Object)) {
                $components = $Analysis.Components | Where-Object { 
                    $_.ApiCalls | Where-Object { $_.Type -eq "Import" -and $_.Url -eq $import }
                } | Select-Object -ExpandProperty Name
                $output += "- ``$import``"
                $output += "  - Used in: " + (($components | Select-Object -Unique) -join ", ")
            }
            $output += ""
        }
        
        # Service Methods Summary
        $serviceMethods = $allApiCalls | Where-Object { $_.Type -eq "Service" } | Select-Object -ExpandProperty Method -Unique
        if ($serviceMethods.Count -gt 0) {
            $output += "### API Service Methods Called"
            $output += ""
            $output += "| Method | Called From Component | Line |"
            $output += "|--------|----------------------|------|"
            
            foreach ($method in ($serviceMethods | Sort-Object)) {
                $calls = @()
                foreach ($component in $Analysis.Components) {
                    $methodCalls = $component.ApiCalls | Where-Object { $_.Type -eq "Service" -and $_.Method -eq $method }
                    foreach ($call in $methodCalls) {
                        $calls += [PSCustomObject]@{
                            Component = $component.Name
                            Line = $call.Line
                        }
                    }
                }
                foreach ($call in $calls) {
                    $output += "| ``$method()`` | ``$($call.Component)`` | $($call.Line) |"
                }
            }
            $output += ""
        }
        
        # HTTP Endpoints Summary
        $httpCalls = $allApiCalls | Where-Object { $_.Type -ne "Import" -and $_.Type -ne "Service" -and $_.Url -and $_.Url -ne "Service method" }
        if ($httpCalls.Count -gt 0) {
            $output += "### HTTP Endpoints"
            $output += ""
            $output += "| Method | URL/Endpoint | Type | Component |"
            $output += "|--------|--------------|------|-----------|"
            
            $uniqueEndpoints = $httpCalls | Sort-Object Url -Unique
            foreach ($endpoint in $uniqueEndpoints) {
                $components = $Analysis.Components | Where-Object {
                    $_.ApiCalls | Where-Object { $_.Url -eq $endpoint.Url }
                } | Select-Object -ExpandProperty Name -Unique
                
                $output += "| ``$($endpoint.Method)`` | ``$($endpoint.Url)`` | $($endpoint.Type) | " + ($components -join ", ") + " |"
            }
            $output += ""
        }
        
        # Statistics
        $totalImports = ($allApiCalls | Where-Object { $_.Type -eq "Import" }).Count
        $totalServiceCalls = ($allApiCalls | Where-Object { $_.Type -eq "Service" }).Count
        $totalHttpCalls = ($allApiCalls | Where-Object { $_.Type -ne "Import" -and $_.Type -ne "Service" }).Count
        
        $output += "### API Call Statistics"
        $output += ""
        $output += "- **Total API Imports:** $totalImports"
        $output += "- **Total Service Method Calls:** $totalServiceCalls"
        $output += "- **Total Direct HTTP Calls:** $totalHttpCalls"
        $output += "- **Total API Interactions:** $($allApiCalls.Count)"
        $output += ""
    }
    
    # Method Dependency Map
    $allMethods = $Analysis.Components | Where-Object { $_.Methods.Count -gt 0 }
    if ($allMethods.Count -gt 0) {
        $output += "## Method Dependency Map"
        $output += ""
        $output += "This section shows which methods call other methods within each component."
        $output += ""
        
        foreach ($component in ($allMethods | Sort-Object FilePath)) {
            $methodsWithCalls = $component.Methods | Where-Object { $_.CallsMethods.Count -gt 0 }
            
            if ($methodsWithCalls.Count -gt 0) {
                # Create a more descriptive header with file path
                $componentHeader = if ($component.Name -eq "index" -or $component.Name -like "*.*") {
                    # If it's an index file or has extension, show the containing folder
                    $folderName = Split-Path (Split-Path $component.FilePath -Parent) -Leaf
                    "$folderName / $($component.Name)"
                } else {
                    $component.Name
                }
                
                $output += "### $componentHeader"
                $output += "**File:** ``$($component.FilePath)``"
                $output += ""
                $output += "| Method | Calls | Type | Line |"
                $output += "|--------|-------|------|------|"
                
                foreach ($method in ($methodsWithCalls | Sort-Object Name)) {
                    $asyncLabel = if ($method.IsAsync) { "Async" } else { "Sync" }
                    $calls = ($method.CallsMethods | ForEach-Object { "``$_()``" }) -join ", "
                    $output += "| ``$($method.Name)()`` | $calls | $asyncLabel | $($method.Line) |"
                }
                $output += ""
            }
        }
        
        # Method Call Graph - Show which methods are called most frequently
        # Only include methods that are actually defined in the components
        $output += "### Method Call Frequency"
        $output += ""
        $output += "Methods that are called by other methods (sorted by frequency):"
        $output += ""
        
        # First, build a set of all defined method names across all components
        $definedMethods = @{}
        foreach ($comp in $Analysis.Components) {
            foreach ($meth in $comp.Methods) {
                if (-not $definedMethods.ContainsKey($meth.Name)) {
                    $definedMethods[$meth.Name] = @{
                        ComponentName = $comp.Name
                        Line = $meth.Line
                    }
                }
            }
        }
        
        # Now track calls only to methods that are actually defined
        $methodCallCount = @{}
        foreach ($component in $Analysis.Components) {
            foreach ($method in $component.Methods) {
                foreach ($calledMethod in $method.CallsMethods) {
                    # Only track if this method is actually defined in our components
                    if ($definedMethods.ContainsKey($calledMethod)) {
                        if (-not $methodCallCount.ContainsKey($calledMethod)) {
                            $methodCallCount[$calledMethod] = @{
                                Count = 0
                                CalledBy = @()
                                DefinedIn = $definedMethods[$calledMethod].ComponentName
                                Line = $definedMethods[$calledMethod].Line
                            }
                        }
                        $methodCallCount[$calledMethod].Count++
                        $methodCallCount[$calledMethod].CalledBy += "$($component.Name).$($method.Name)()"
                    }
                }
            }
        }
        
        if ($methodCallCount.Count -gt 0) {
            $output += "| Method | Defined In | Line | Times Called | Called By |"
            $output += "|--------|------------|------|--------------|-----------|"
            
            $sortedMethods = $methodCallCount.GetEnumerator() | Sort-Object { $_.Value.Count } -Descending
            foreach ($entry in $sortedMethods) {
                $calledBy = ($entry.Value.CalledBy | Select-Object -Unique | ForEach-Object { "``$_``" }) -join ", "
                if ($calledBy.Length -gt 80) {
                    $calledBy = $calledBy.Substring(0, 77) + "..."
                }
                $output += "| ``$($entry.Key)()`` | ``$($entry.Value.DefinedIn)`` | $($entry.Value.Line) | $($entry.Value.Count) | $calledBy |"
            }
            $output += ""
        } else {
            $output += "_No inter-method calls detected within components._"
            $output += ""
        }
        
        # Method Statistics
        $totalMethods = ($Analysis.Components | ForEach-Object { $_.Methods }).Count
        $totalAsyncMethods = ($Analysis.Components | ForEach-Object { $_.Methods | Where-Object { $_.IsAsync } }).Count
        $totalMethodCalls = ($Analysis.Components | ForEach-Object { $_.Methods | ForEach-Object { $_.CallsMethods } }).Count
        
        $output += "### Method Statistics"
        $output += ""
        $output += "- **Total Methods:** $totalMethods"
        $output += "- **Async Methods:** $totalAsyncMethods"
        $output += "- **Total Method Calls:** $totalMethodCalls"
        $avgMethodCalls = if ($totalMethods -gt 0) { [math]::Round($totalMethodCalls / $totalMethods, 2) } else { 0 }
        $output += "- **Average Method Calls per Method:** $avgMethodCalls"
        $output += ""
    }
    
    # Custom Hooks
    if ($Analysis.CustomHooks.Count -gt 0) {
        $output += "## Custom Hooks"
        $output += ""
        foreach ($hook in ($Analysis.CustomHooks | Sort-Object Name)) {
            $output += "### $($hook.Name)"
            $output += "- **File:** ``$($hook.FilePath)``"
            $output += "- **Returns:** ``$($hook.Returns)``"
            if ($hook.Dependencies.Count -gt 0) {
                $output += "- **Uses:** " + (($hook.Dependencies | Select-Object -Unique) -join ", ")
            }
            $output += ""
        }
    }
    
    # Component Dependency Graph
    if ($Analysis.ComponentDependencies.Count -gt 0) {
        $output += "## Component Dependency Graph"
        $output += ""
        $output += "| Component | Imports | Path |"
        $output += "|-----------|---------|------|"
        foreach ($dep in ($Analysis.ComponentDependencies | Sort-Object From, To)) {
            $output += "| ``$($dep.From)`` | ``$($dep.To)`` | ``$($dep.ImportPath)`` |"
        }
        $output += ""
    }
    
    $output -join "`n" | Set-Content $OutputFile
}

function Format-TagReport {
    param($Analysis, $OutputFile)
    
    $output = @()
    $output += "# Repository Tags"
    $output += ""
    $output += "**Repository:** $($Analysis.Repository)  "
    $output += "**Generated:** $($Analysis.GeneratedAt)  "
    $output += "**Total Tags:** $($Analysis.TotalTags)"
    $output += ""
    
    foreach ($category in $Analysis.TagsByCategory.Keys) {
        $tags = $Analysis.TagsByCategory[$category]
        if ($tags.Count -gt 0) {
            $output += "## $category"
            $output += ""
            foreach ($tag in $tags) {
                $output += "- $tag"
            }
            $output += ""
        }
    }
    
    $output += "## All Tags (Comma-Separated)"
    $output += ""
    $output += ($Analysis.AllTags -join ", ")
    $output += ""
    
    $output += "## Keywords for Search/SEO"
    $output += ""
    $output += ($Analysis.Keywords -join ", ")
    $output += ""
    
    $output -join "`n" | Set-Content $OutputFile
}

function Show-UniversalGeneratedFiles {
    Write-Host "`n📄 Documentation Files in $OutputDir :" -ForegroundColor Cyan
    
    $docFiles = @(
        @{ File = "REPOSITORY_INSTRUCTIONS.md"; Description = "Complete setup guide with architecture overview" }
        @{ File = "REPOSITORY_INSTRUCTIONS.json"; Description = "Structured analysis data from comprehensive generator" }
        @{ File = "QUICK_START.md"; Description = "Essential quick start commands and setup" }
        @{ File = "QUICK_START.json"; Description = "Structured quick analysis data" }
        @{ File = "repo-analysis.json"; Description = "Machine-readable repository analysis data" }
        @{ File = "BUSINESS_LOGIC_FLOWS.md"; Description = "Business logic flow analysis with call traces" }
        @{ File = "BUSINESS_LOGIC_FLOWS.json"; Description = "Structured business logic and entry point data" }
        @{ File = "CLASS_CATALOG.md"; Description = "Complete catalog of DTOs and key classes" }
        @{ File = "CLASS_CATALOG.json"; Description = "Structured class and DTO information" }
        @{ File = "REPOSITORY_TAGS.md"; Description = "Intelligent tags for classification" }
        @{ File = "REPOSITORY_TAGS.json"; Description = "Structured tag and keyword data" }
        @{ File = "TECH_STACK.md"; Description = "Basic technology stack overview" }
    )
    
    $foundAny = $false
    foreach ($doc in $docFiles) {
        $filePath = Join-Path $OutputDir $doc.File
        if (Test-Path $filePath) {
            $size = [math]::Round((Get-Item $filePath).Length / 1KB, 1)
            $lastModified = (Get-Item $filePath).LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            Write-Host "  ✅ $($doc.File) ($size KB, modified: $lastModified)" -ForegroundColor Green
            Write-Host "     $($doc.Description)" -ForegroundColor Gray
            $foundAny = $true
        } else {
            Write-Host "  ⭕ $($doc.File) (not generated)" -ForegroundColor Yellow
        }
    }
    
    if (-not $foundAny) {
        Write-Host "  ℹ️  No documentation files found. Generate some documentation first!" -ForegroundColor Gray
    }
}

function Remove-UniversalGeneratedFiles {
    Write-Host "`n🧹 Cleaning up documentation files in $OutputDir ..." -ForegroundColor Yellow
    
    $filesToRemove = @(
        "REPOSITORY_INSTRUCTIONS.md",
        "REPOSITORY_INSTRUCTIONS.json",
        "QUICK_START.md",
        "QUICK_START.json", 
        "TECH_STACK.md",
        "repo-analysis.json",
        "BUSINESS_LOGIC_FLOWS.md",
        "BUSINESS_LOGIC_FLOWS.json",
        "CLASS_CATALOG.md",
        "CLASS_CATALOG.json",
        "REPOSITORY_TAGS.md",
        "REPOSITORY_TAGS.json",
        "REACT_ANALYSIS.md",
        "REACT_ANALYSIS.json"
    )
    
    $removedCount = 0
    foreach ($file in $filesToRemove) {
        $filePath = Join-Path $OutputDir $file
        if (Test-Path $filePath) {
            Remove-Item $filePath -Force
            Write-Host "  🗑️  Removed: $file" -ForegroundColor Red
            $removedCount++
        }
    }
    
    if ($removedCount -eq 0) {
        Write-Host "  ℹ️  No documentation files found to remove." -ForegroundColor Gray
    } else {
        Write-Host "`n✅ Cleaned up $removedCount file(s)" -ForegroundColor Green
    }
}

function Get-UniversalRepositoryInfo {
    Write-Host "`n📊 Repository Analysis:" -ForegroundColor Cyan
    Write-Host "  Repository: $repoName"
    Write-Host "  Location: $RepositoryPath"
    Write-Host "  Output Directory: $OutputDir"
    
    # Quick project count
    $dotnetCount = (Get-ChildItem -Path $RepositoryPath -Recurse -Filter "*.csproj" -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\bin\*" -and $_.FullName -notlike "*\obj\*" }).Count
    
    $nodeCount = (Get-ChildItem -Path $RepositoryPath -Recurse -Filter "package.json" -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\node_modules\*" -and $_.FullName -notlike "*/node_modules/*" }).Count
    
    $pythonCount = (Get-ChildItem -Path $RepositoryPath -Recurse -Include "requirements.txt", "setup.py", "pyproject.toml" -ErrorAction SilentlyContinue).Count
    
    $javaCount = (Get-ChildItem -Path $RepositoryPath -Recurse -Filter "pom.xml" -ErrorAction SilentlyContinue).Count
    
    $reactCount = (Get-ChildItem -Path $RepositoryPath -Recurse -Include "*.tsx","*.jsx" -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\node_modules\*" -and $_.FullName -notlike "*\dist\*" -and $_.FullName -notlike "*\build\*" }).Count
    
    Write-Host "  Projects Found:"
    if ($dotnetCount -gt 0) { Write-Host "    - $dotnetCount .NET projects" -ForegroundColor Gray }
    if ($nodeCount -gt 0) { Write-Host "    - $nodeCount Node.js projects" -ForegroundColor Gray }
    if ($reactCount -gt 0) { Write-Host "    - $reactCount React components" -ForegroundColor Gray }
    if ($pythonCount -gt 0) { Write-Host "    - $pythonCount Python indicators" -ForegroundColor Gray }
    if ($javaCount -gt 0) { Write-Host "    - $javaCount Java projects" -ForegroundColor Gray }
    
    if ($dotnetCount + $nodeCount + $pythonCount + $javaCount + $reactCount -eq 0) {
        Write-Host "    - No recognized project types found" -ForegroundColor Yellow
        Write-Host "    - The analyzer will still attempt to document the repository" -ForegroundColor Gray
    }
    
    return @{
        IsDotNet = $dotnetCount -gt 0
        IsNode = $nodeCount -gt 0
        IsReact = $reactCount -gt 0
        IsPython = $pythonCount -gt 0
        IsJava = $javaCount -gt 0
    }
}

# Main execution
try {
    Show-UniversalBanner
    # Get-UniversalRepositoryInfo

    switch ($Action) {
        'full' {
            Invoke-UniversalFullGeneration
        }
        'quick' {
            Invoke-UniversalQuickGeneration
        }
        'json' {
            Invoke-UniversalJsonGeneration
        }
        'business-logic' {
            Invoke-BusinessLogicAnalysis
        }
        'dtos' {
            Invoke-DTOExtraction
        }
        'tags' {
            Invoke-TagGeneration
        }
        'all' {
            Write-Host "`n🚀 Generating all basic formats..." -ForegroundColor Green
            Invoke-UniversalFullGeneration
            Invoke-UniversalQuickGeneration
            Invoke-UniversalJsonGeneration
            Write-Host "`n✅ All basic formats generated!" -ForegroundColor Green
            Show-UniversalGeneratedFiles
        }
        'deep' {
            Write-Host "`n🚀 Generating complete deep analysis..." -ForegroundColor Green
            
            # Detect project type
            $projectInfo = Get-UniversalRepositoryInfo
            
            Invoke-UniversalFullGeneration
            Invoke-UniversalQuickGeneration
            Invoke-UniversalJsonGeneration
            
            # Run .NET-specific analysis
            if ($projectInfo.IsDotNet) {
                Invoke-BusinessLogicAnalysis
                Invoke-DTOExtraction
            }
            
            # Run React-specific analysis
            if ($projectInfo.IsReact) {
                Invoke-ReactAnalysis
            }
            
            Invoke-TagGeneration
            Write-Host "`n✅ Complete deep analysis generated!" -ForegroundColor Green
            Show-UniversalGeneratedFiles
        }
        'clean' {
            Remove-UniversalGeneratedFiles
        }
        'analyze' {
            do {
                Show-UniversalMenu
                $choice = Get-UserChoice
                
                switch ($choice) {
                    1 { Invoke-UniversalFullGeneration }
                    2 { Invoke-UniversalQuickGeneration }
                    3 { Invoke-UniversalJsonGeneration }
                    4 { Invoke-BusinessLogicAnalysis }
                    5 { Invoke-DTOExtraction }
                    6 { Invoke-ReactAnalysis }
                    7 { Invoke-TagGeneration }
                    8 { 
                        Write-Host "`n🚀 Generating complete deep analysis..." -ForegroundColor Green
                        $projectInfo = Get-UniversalRepositoryInfo
                        Invoke-UniversalFullGeneration
                        Invoke-UniversalQuickGeneration  
                        Invoke-UniversalJsonGeneration
                        if ($projectInfo.IsDotNet) {
                            Invoke-BusinessLogicAnalysis
                            Invoke-DTOExtraction
                        }
                        if ($projectInfo.IsReact) {
                            Invoke-ReactAnalysis
                        }
                        Invoke-TagGeneration
                        Write-Host "`n✅ Complete analysis finished!" -ForegroundColor Green
                        Show-UniversalGeneratedFiles
                    }
                    9 { Show-UniversalGeneratedFiles }
                    10 { Remove-UniversalGeneratedFiles }
                    11 { 
                        $newPath = Get-RepositoryPath
                        Pop-Location
                        $RepositoryPath = $newPath
                        $OutputDir = $RepositoryPath
                        $repoName = Split-Path $RepositoryPath -Leaf
                        Push-Location $RepositoryPath
                        Get-UniversalRepositoryInfo
                    }
                    12 { 
                        Write-Host "`n👋 Thanks for using the Universal Repository Documentation Suite!" -ForegroundColor Cyan
                        Write-Host "💡 You can copy these scripts to any repository for instant documentation!" -ForegroundColor Yellow
                        break
                    }
                }
                
                if ($choice -notin @(11, 12)) {
                    Write-Host "`nPress any key to continue..." -ForegroundColor Gray
                    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                }
            } while ($choice -ne 12)
        }
    }

} catch {
    Write-Error "Documentation generation failed: $($_.Exception.Message)"
    exit 1
} finally {
    Pop-Location
}

Write-Host "`n💡 Tip: Copy these scripts to any repository for instant documentation generation!" -ForegroundColor Yellow