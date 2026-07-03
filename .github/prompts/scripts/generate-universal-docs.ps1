#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Universal Repository Documentation Generator

.DESCRIPTION
    Analyzes any code repository and generates comprehensive documentation describing
    the tech stack, architecture, and dependencies. Works with any repository structure
    and supports multiple programming languages and frameworks.

.PARAMETER OutputFile
    Path to the output markdown file. Defaults to "REPOSITORY_INSTRUCTIONS.md"

.PARAMETER JsonOutput
    Also generate JSON output file alongside markdown. Defaults to true

.PARAMETER RepositoryPath
    Path to the repository root. Defaults to current directory.

.PARAMETER SkipTests
    Skip test projects in the analysis

.EXAMPLE
    .\generate-universal-docs.ps1
    
.EXAMPLE
    .\generate-universal-docs.ps1 -OutputFile "docs/setup-guide.md" -RepositoryPath "C:\path\to\any\repo"
    
.EXAMPLE
    .\generate-universal-docs.ps1 -SkipTests
#>

param(
    [string]$OutputFile = "REPOSITORY_INSTRUCTIONS.md",
    [string]$RepositoryPath = ".",
    [switch]$SkipTests = $false,
    [switch]$JsonOutput = $true,
    [switch]$IncludeBusinessLogic = $false,
    [switch]$IncludeDTOs = $false,
    [switch]$IncludeTags = $false,
    [switch]$DeepAnalysis = $false
)

# Ensure we're working with absolute paths
$RepositoryPath = Resolve-Path $RepositoryPath
$OutputPath = if ([System.IO.Path]::IsPathRooted($OutputFile)) { $OutputFile } else { Join-Path $RepositoryPath $OutputFile }

# Create output directory if it doesn't exist
$OutputDirectory = Split-Path -Path $OutputPath -Parent
if ($OutputDirectory -and -not (Test-Path $OutputDirectory)) {
    Write-Host "📁 Creating output directory: $OutputDirectory" -ForegroundColor Yellow
    New-Item -Path $OutputDirectory -ItemType Directory -Force | Out-Null
}

Write-Host "🔍 Analyzing repository at: $RepositoryPath" -ForegroundColor Green
Write-Host "📝 Output will be written to: $OutputPath" -ForegroundColor Green

function Get-SafeContent {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        try {
            return Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
        } catch {
            return $null
        }
    }
    return $null
}

function Get-SafeJsonContent {
    param([string]$FilePath)
    $content = Get-SafeContent $FilePath
    if ($content) {
        try {
            return $content | ConvertFrom-Json
        } catch {
            Write-Warning "Failed to parse JSON file: $FilePath"
            return $null
        }
    }
    return $null
}

function Get-SafeXmlContent {
    param([string]$FilePath)
    $content = Get-SafeContent $FilePath
    if ($content) {
        try {
            return [xml]$content
        } catch {
            Write-Warning "Failed to parse XML file: $FilePath"
            return $null
        }
    }
    return $null
}

function Analyze-UniversalProjects {
    $projects = @()
    
    # Find .NET projects
    $csprojFiles = Get-ChildItem -Path $RepositoryPath -Recurse -Filter "*.csproj" -ErrorAction SilentlyContinue | 
        Where-Object { 
            $_.FullName -notlike "*\bin\*" -and 
            $_.FullName -notlike "*\obj\*" -and
            ($_.Name -notlike "*test*" -or -not $SkipTests)
        }
    
    foreach ($file in $csprojFiles) {
        $xml = Get-SafeXmlContent $file.FullName
        if ($xml -and $xml.Project) {
            # Debug: Let's see what we're getting
            $targetFrameworkValue = $null
            
            # Handle multiple PropertyGroup elements properly
            if ($xml.Project.PropertyGroup) {
                $propGroups = @($xml.Project.PropertyGroup)
                foreach ($propGroup in $propGroups) {
                    if ($propGroup -and $propGroup.TargetFramework -and $propGroup.TargetFramework -ne '') {
                        $targetFrameworkValue = $propGroup.TargetFramework
                        break
                    } elseif ($propGroup -and $propGroup.TargetFrameworkVersion -and $propGroup.TargetFrameworkVersion -ne '') {
                        $targetFrameworkValue = $propGroup.TargetFrameworkVersion
                        break
                    }
                }
            }
            
            # Ensure we have a string value, not an array or object
            if ($targetFrameworkValue -is [array] -and $targetFrameworkValue.Count -gt 0) {
                $targetFrameworkValue = $targetFrameworkValue[0]
            }
            if ($targetFrameworkValue -and $targetFrameworkValue.GetType().Name -eq "XmlElement") {
                $targetFrameworkValue = $targetFrameworkValue.'#text'
            }
            
            Write-Host "File: $($file.Name), TargetFramework: '$targetFrameworkValue'" -ForegroundColor Yellow
            
            $project = @{
                Type = "dotnet"
                Name = $file.BaseName
                Path = $file.FullName.Replace($RepositoryPath, "").TrimStart('\', '/')
                TargetFramework = $targetFrameworkValue
                Packages = @()
                IsTest = $file.Name -like "*test*" -or $file.Name -like "*Test*"
            }
            
            # Extract package references
            foreach ($itemGroup in $xml.Project.ItemGroup) {
                if ($itemGroup.PackageReference) {
                    foreach ($packageRef in $itemGroup.PackageReference) {
                        if ($packageRef.Include) {
                            $project.Packages += @{
                                Name = $packageRef.Include
                                Version = $packageRef.Version
                            }
                        }
                    }
                }
            }
            
            $projects += $project
        }
    }
    
    # Find Node.js projects
    $packageJsonFiles = Get-ChildItem -Path $RepositoryPath -Recurse -Filter "package.json" -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\node_modules\*" -and $_.FullName -notlike "*/node_modules/*" }
    
    foreach ($file in $packageJsonFiles) {
        $json = Get-SafeJsonContent $file.FullName
        if ($json) {
            $project = @{
                Type = "nodejs"
                Name = if ($json.name) { $json.name } else { "nodejs-project" }
                Path = $file.FullName.Replace($RepositoryPath, "").TrimStart('\', '/')
                Version = $json.version
                Dependencies = @()
                DevDependencies = @()
                Scripts = @()
                IsTest = $false
            }
            
            # Extract scripts
            if ($json.scripts) {
                foreach ($script in $json.scripts.PSObject.Properties) {
                    $project.Scripts += @{
                        Name = $script.Name
                        Command = $script.Value
                    }
                }
            }
            
            # Extract dependencies
            if ($json.dependencies) {
                foreach ($dep in $json.dependencies.PSObject.Properties) {
                    $project.Dependencies += @{
                        Name = $dep.Name
                        Version = $dep.Value
                    }
                }
            }
            
            if ($json.devDependencies) {
                foreach ($dep in $json.devDependencies.PSObject.Properties) {
                    $project.DevDependencies += @{
                        Name = $dep.Name
                        Version = $dep.Value
                    }
                }
            }
            
            $projects += $project
        }
    }
    
    # Find Python projects
    $pythonFiles = @()
    $pythonFiles += Get-ChildItem -Path $RepositoryPath -Recurse -Filter "requirements.txt" -ErrorAction SilentlyContinue
    $pythonFiles += Get-ChildItem -Path $RepositoryPath -Recurse -Filter "setup.py" -ErrorAction SilentlyContinue
    $pythonFiles += Get-ChildItem -Path $RepositoryPath -Recurse -Filter "pyproject.toml" -ErrorAction SilentlyContinue
    
    if ($pythonFiles.Count -gt 0) {
        $project = @{
            Type = "python"
            Name = "python-project"
            Path = "Python project detected"
            Dependencies = @()
            IsTest = $false
        }
        $projects += $project
    }
    
    # Find Java projects
    $javaFiles = Get-ChildItem -Path $RepositoryPath -Recurse -Filter "pom.xml" -ErrorAction SilentlyContinue
    foreach ($file in $javaFiles) {
        $project = @{
            Type = "java"
            Name = "java-maven-project"
            Path = $file.FullName.Replace($RepositoryPath, "").TrimStart('\', '/')
            Dependencies = @()
            IsTest = $false
        }
        $projects += $project
    }
    
    return $projects
}

function Analyze-UniversalTechStack {
    param($Projects)
    
    $techStack = @{
        Backend = @()
        Frontend = @()
        Database = @()
        Caching = @()
        Cloud = @()
        Mobile = @()
        DevTools = @()
        Testing = @()
        Paycor = @()
        Other = @()
    }
    
    $appPatterns = @{
        AzureFunctions = @()
        WebAPI = @()
        BackgroundWorkers = @()
        Microservices = @()
        EventDriven = @()
        Authentication = @()
        DataAccess = @()
        Other = @()
    }
    
    foreach ($project in $Projects) {
        switch ($project.Type) {
            "dotnet" {
                $framework = $project.TargetFramework
                if ($framework -and $framework -ne '') {
                    if ($framework -like "net*" -or $framework -like "v*") {
                        $techStack.Backend += ".NET $framework"
                    }
                }
                
                # Analyze packages
                foreach ($package in $project.Packages) {
                    $name = $package.Name.ToLower()
                    # Check for Paycor packages first
                    if ($name -match "paycor") {
                        $techStack.Paycor += "$($package.Name) v$($package.Version)"
                    }
                    # Then categorize by other criteria
                    elseif ($name -match "azure") { $techStack.Cloud += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "aws") { $techStack.Cloud += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "google.*cloud") { $techStack.Cloud += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "sqlclient") { $techStack.Database += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "dapper") { $techStack.Database += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "entityframework") { $techStack.Database += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "mongodb") { $techStack.Database += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "redis|stackexchange\.redis|microsoft\.extensions\.caching\.redis") { $techStack.Caching += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "aspnetcore") { $techStack.Backend += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "swagger") { $techStack.DevTools += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "test" -and -not $SkipTests) { $techStack.Testing += "$($package.Name) v$($package.Version)" }
                    elseif ($name -match "blazor") { $techStack.Frontend += "$($package.Name) v$($package.Version)" }
                    else { $techStack.Other += "$($package.Name) v$($package.Version)" }
                    
                    # Application Pattern Detection from NuGet packages
                    if ($name -match "Microsoft\.Azure\.Functions") { $appPatterns.AzureFunctions += "Azure Functions Runtime" }
                    if ($name -match "Microsoft\.Azure\.WebJobs") { $appPatterns.AzureFunctions += "Azure WebJobs SDK" }
                    if ($name -match "Microsoft\.DurableTask") { $appPatterns.AzureFunctions += "Durable Task Framework" }
                    if ($name -match "Microsoft\.Azure\.DurableTask") { $appPatterns.AzureFunctions += "Durable Functions" }
                    if ($name -match "Microsoft\.Extensions\.Hosting") { $appPatterns.BackgroundWorkers += "Background Services" }
                    if ($name -match "Microsoft\.AspNetCore\.Mvc") { $appPatterns.WebAPI += "MVC Controllers" }
                    if ($name -match "Microsoft\.AspNetCore\.Authentication") { $appPatterns.Authentication += "ASP.NET Authentication" }
                    if ($name -match "Microsoft\.Identity") { $appPatterns.Authentication += "Microsoft Identity" }
                    if ($name -match "Microsoft\.EntityFrameworkCore") { $appPatterns.DataAccess += "Entity Framework Core" }
                    if ($name -match "Microsoft\.ServiceBus") { $appPatterns.EventDriven += "Azure Service Bus" }
                    if ($name -match "Microsoft\.Azure\.EventHubs") { $appPatterns.EventDriven += "Azure Event Hubs" }
                    if ($name -match "Microsoft\.Azure\.EventGrid") { $appPatterns.EventDriven += "Azure Event Grid" }
                    if ($name -match "Microsoft\.Extensions\.DependencyInjection") { $appPatterns.Microservices += "Dependency Injection" }
                    if ($name -match "Polly") { $appPatterns.Microservices += "Resilience Patterns (Polly)" }
                    if ($name -match "Ocelot") { $appPatterns.Microservices += "API Gateway (Ocelot)" }
                }
            }
            "nodejs" {
                # Analyze dependencies
                foreach ($dep in $project.Dependencies) {
                    $name = $dep.Name.ToLower()
                    # Check for Paycor packages first
                    if ($name -match "paycor") {
                        $techStack.Paycor += "$($dep.Name) v$($dep.Version)"
                    }
                    # Then categorize by other criteria
                    elseif ($name -match "react") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "vue") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "angular") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "svelte") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "express") { $techStack.Backend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "fastify") { $techStack.Backend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "nest") { $techStack.Backend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "next") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "gatsby") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "nuxt") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "mui") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "material") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "bootstrap") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "tailwind") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "emotion") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "styled") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "axios") { $techStack.Frontend += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "mongoose") { $techStack.Database += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "prisma") { $techStack.Database += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "sequelize") { $techStack.Database += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "typeorm") { $techStack.Database += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "redis|ioredis|node_redis|node-redis") { $techStack.Caching += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "react-native") { $techStack.Mobile += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "ionic") { $techStack.Mobile += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "vite") { $techStack.DevTools += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "webpack") { $techStack.DevTools += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "typescript") { $techStack.DevTools += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "eslint") { $techStack.DevTools += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "prettier") { $techStack.DevTools += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "jest" -and -not $SkipTests) { $techStack.Testing += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "cypress" -and -not $SkipTests) { $techStack.Testing += "$($dep.Name) v$($dep.Version)" }
                    elseif ($name -match "testing-library" -and -not $SkipTests) { $techStack.Testing += "$($dep.Name) v$($dep.Version)" }
                    else { $techStack.Other += "$($dep.Name) v$($dep.Version)" }
                }
            }
            "python" {
                $techStack.Backend += "Python"
            }
            "java" {
                $techStack.Backend += "Java (Maven)"
            }
        }
    }
    
    return @{
        TechStack = $techStack
        ApplicationPatterns = $appPatterns
    }
}

function Get-UniversalDirectoryStructure {
    param([string]$Path, [int]$MaxDepth = 3, [int]$CurrentDepth = 0)
    
    if ($CurrentDepth -ge $MaxDepth) { return "" }
    
    $structure = ""
    $items = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue | Where-Object { 
        $_.Name -notlike "bin" -and 
        $_.Name -notlike "obj" -and 
        $_.Name -notlike "node_modules" -and 
        $_.Name -notlike ".git" -and
        $_.Name -notlike "*.user" -and
        $_.Name -notlike "__pycache__" -and
        $_.Name -notlike ".pytest_cache" -and
        $_.Name -notlike "target" -and
        $_.Name -notlike "dist" -and
        $_.Name -notlike "build"
    } | Sort-Object { $_.PSIsContainer }, Name
    
    foreach ($item in $items) {
        $indent = "  " * $CurrentDepth
        if ($item.PSIsContainer) {
            $structure += "$indent├── $($item.Name)/`n"
            if ($CurrentDepth -lt $MaxDepth - 1) {
                $subStructure = Get-UniversalDirectoryStructure -Path $item.FullName -MaxDepth $MaxDepth -CurrentDepth ($CurrentDepth + 1)
                $structure += $subStructure
            }
        } else {
            $structure += "$indent├── $($item.Name)`n"
        }
    }
    
    return $structure
}

function Get-SetupInstructions {
    param($Projects)
    
    $instructions = @()
    $hasBackend = $false
    $hasFrontend = $false
    
    # Detect project types
    foreach ($project in $Projects | Where-Object { -not $_.IsTest }) {
        if ($project.Type -eq "dotnet") {
            $hasBackend = $true
            $instructions += @"
### Setup .NET Backend ($($project.Name))

``````bash
# Navigate to the project directory
cd $(Split-Path $project.Path -Parent)

# Restore packages and build
dotnet restore
dotnet build

# Run the application
dotnet run
``````

**Configuration:**
- Update configuration files (appsettings.json, etc.) with your environment settings
- Configure database connection strings if applicable
- Set up any required API keys or external service endpoints

**Default URL:** The application will typically run on ``https://localhost:5001`` or ``http://localhost:5000``
"@
        }
        elseif ($project.Type -eq "nodejs") {
            $hasFrontend = $true
            $hasStartScript = $project.Scripts | Where-Object { $_.Name -eq "start" }
            $hasBuildScript = $project.Scripts | Where-Object { $_.Name -eq "build" }
            
            $instructions += @"
### Setup Node.js Application ($($project.Name))

``````bash
# Navigate to the project directory
cd $(Split-Path $project.Path -Parent)

# Install dependencies
npm install
# OR if you prefer yarn
# yarn install

# Run in development mode
$(if ($hasStartScript) { "npm start" } else { "npm run dev" })
``````

$(if ($hasBuildScript) {
"**Build for Production:**
``````bash
npm run build
``````"
})

**Available Scripts:**
$(foreach ($script in $project.Scripts) {
    "- ``npm run $($script.Name)`` - $($script.Command)`n"
})

**Default URL:** Typically runs on ``http://localhost:3000`` or as configured
"@
        }
    }
    
    return $instructions -join "`n`n"
}

function Export-JsonAnalysis {
    param($Projects, $TechStack, $ApplicationPatterns, $RepositoryPath, $OutputPath, $BusinessLogicData = $null, $DTOData = $null, $TagData = $null)
    
    try {
        $repoName = Split-Path $RepositoryPath -Leaf
        $jsonData = @{
            Repository = @{
                Name = $repoName
                Path = $RepositoryPath.ToString()
                Generated = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                AnalysisVersion = "1.0"
            }
            Projects = @{
                Summary = @{
                    Total = $Projects.Count
                    DotNet = ($Projects | Where-Object { $_.Type -eq "dotnet" }).Count
                    NodeJS = ($Projects | Where-Object { $_.Type -eq "nodejs" }).Count
                    Python = ($Projects | Where-Object { $_.Type -eq "python" }).Count
                    Java = ($Projects | Where-Object { $_.Type -eq "java" }).Count
                }
                Details = @($Projects | ForEach-Object {
                    @{
                        Name = $_.Name
                        Type = $_.Type
                        Path = $_.Path
                        TargetFramework = if ($_.TargetFramework -and $_.TargetFramework -ne $null) { 
                            # Handle both single values and arrays
                            $frameworkValue = if ($_.TargetFramework -is [array]) {
                                $_.TargetFramework | Where-Object { $_ -ne $null } | Select-Object -First 1
                            } else {
                                $_.TargetFramework
                            }
                            # Format with .NET prefix to match markdown
                            if ($frameworkValue -and $frameworkValue -ne '') {
                                ".NET $frameworkValue"
                            } else {
                                $null
                            }
                        } else { 
                            $null 
                        }
                        Version = if ($_.Version) { $_.Version } else { $null }
                        IsTest = if ($_.IsTest) { $_.IsTest } else { $false }
                        PackageCount = if ($_.Packages) { $_.Packages.Count } else { 0 }
                        DependencyCount = if ($_.Dependencies) { $_.Dependencies.Count } else { 0 }
                    }
                })
            }
            TechStack = @{
                Summary = @{
                    TotalCategories = ($TechStack.Keys | Where-Object { $TechStack[$_] -and $TechStack[$_].Count -gt 0 }).Count
                    TotalTechnologies = ($TechStack.Values | Where-Object { $_ } | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
                }
                Paycor = @($TechStack.Paycor | Sort-Object | Get-Unique)
                Backend = @($TechStack.Backend | Sort-Object | Get-Unique)
                Frontend = @($TechStack.Frontend | Sort-Object | Get-Unique)
                Database = @($TechStack.Database | Sort-Object | Get-Unique)
                Caching = @($TechStack.Caching | Sort-Object | Get-Unique)
                Cloud = @($TechStack.Cloud | Sort-Object | Get-Unique)
                Mobile = @($TechStack.Mobile | Sort-Object | Get-Unique)
                DevTools = @($TechStack.DevTools | Sort-Object | Get-Unique)
                Testing = @($TechStack.Testing | Sort-Object | Get-Unique)
                Other = @($TechStack.Other | Sort-Object | Get-Unique)
            }
            ApplicationPatterns = @{
                Summary = @{
                    TotalCategories = (($ApplicationPatterns.AzureFunctions | Sort-Object | Get-Unique), ($ApplicationPatterns.WebAPI | Sort-Object | Get-Unique), ($ApplicationPatterns.BackgroundWorkers | Sort-Object | Get-Unique), ($ApplicationPatterns.Microservices | Sort-Object | Get-Unique), ($ApplicationPatterns.EventDriven | Sort-Object | Get-Unique), ($ApplicationPatterns.Authentication | Sort-Object | Get-Unique), ($ApplicationPatterns.DataAccess | Sort-Object | Get-Unique), ($ApplicationPatterns.Other | Sort-Object | Get-Unique) | Where-Object { $_.Count -gt 0 }).Count
                    TotalPatterns = (($ApplicationPatterns.AzureFunctions | Sort-Object | Get-Unique).Count + ($ApplicationPatterns.WebAPI | Sort-Object | Get-Unique).Count + ($ApplicationPatterns.BackgroundWorkers | Sort-Object | Get-Unique).Count + ($ApplicationPatterns.Microservices | Sort-Object | Get-Unique).Count + ($ApplicationPatterns.EventDriven | Sort-Object | Get-Unique).Count + ($ApplicationPatterns.Authentication | Sort-Object | Get-Unique).Count + ($ApplicationPatterns.DataAccess | Sort-Object | Get-Unique).Count + ($ApplicationPatterns.Other | Sort-Object | Get-Unique).Count)
                }
                AzureFunctions = @($ApplicationPatterns.AzureFunctions | Sort-Object | Get-Unique)
                WebAPI = @($ApplicationPatterns.WebAPI | Sort-Object | Get-Unique)
                BackgroundWorkers = @($ApplicationPatterns.BackgroundWorkers | Sort-Object | Get-Unique)
                Microservices = @($ApplicationPatterns.Microservices | Sort-Object | Get-Unique)
                EventDriven = @($ApplicationPatterns.EventDriven | Sort-Object | Get-Unique)
                Authentication = @($ApplicationPatterns.Authentication | Sort-Object | Get-Unique)
                DataAccess = @($ApplicationPatterns.DataAccess | Sort-Object | Get-Unique)
                Other = @($ApplicationPatterns.Other | Sort-Object | Get-Unique)
            }
            Prerequisites = @{
                DotNet = @{
                    Required = [bool]($Projects | Where-Object { $_.Type -eq "dotnet" })
                    Frameworks = @($Projects | Where-Object { $_.Type -eq "dotnet" } | ForEach-Object { 
                        if ($_.TargetFramework -and $_.TargetFramework -ne '') { 
                            ".NET $($_.TargetFramework)" 
                        } 
                    } | Where-Object { $_ } | Sort-Object | Get-Unique)
                    DownloadUrl = "https://dotnet.microsoft.com/download"
                }
                NodeJS = @{
                    Required = [bool]($Projects | Where-Object { $_.Type -eq "nodejs" })
                    Version = "16+"
                    DownloadUrl = "https://nodejs.org/"
                    PackageManager = "npm or yarn"
                }
                Python = @{
                    Required = [bool]($Projects | Where-Object { $_.Type -eq "python" })
                    Version = "3.8+"
                    DownloadUrl = "https://python.org/"
                    PackageManager = "pip"
                }
                Java = @{
                    Required = [bool]($Projects | Where-Object { $_.Type -eq "java" })
                    Version = "11+"
                    DownloadUrl = "https://adoptium.net/"
                    BuildTool = "Maven"
                }
                Other = @(
                    "Git - For version control",
                    "IDE/Editor - Visual Studio Code, Visual Studio, IntelliJ IDEA, etc."
                )
            }
            Dependencies = @{
                Summary = @{
                    TotalProjects = $Projects.Count
                    TotalPackages = ($Projects | Where-Object { $_.Packages } | ForEach-Object { $_.Packages.Count } | Measure-Object -Sum).Sum
                    TotalDependencies = ($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies.Count } | Measure-Object -Sum).Sum
                }
                ByProject = @($Projects | Where-Object { $_.Packages -or $_.Dependencies } | ForEach-Object {
                    $projectDeps = @{
                        ProjectName = $_.Name
                        ProjectType = $_.Type
                        ProjectPath = $_.Path
                    }
                    
                    if ($_.Packages -and $_.Packages.Count -gt 0) {
                        $projectDeps.NuGetPackages = @($_.Packages | ForEach-Object {
                            @{
                                Name = $_.Name
                                Version = $_.Version
                                Type = if ($_.Name -match "Test|Mock|Xunit|NUnit|MSTest") { "Testing" }
                                      elseif ($_.Name -match "Microsoft\.AspNetCore") { "Web Framework" }
                                      elseif ($_.Name -match "Microsoft\.EntityFrameworkCore") { "ORM" }
                                      elseif ($_.Name -match "Azure|AWS|Google\.Cloud") { "Cloud" }
                                      elseif ($_.Name -match "Paycor") { "Paycor" }
                                      else { "Library" }
                            }
                        })
                    }
                    
                    if ($_.Dependencies -and $_.Dependencies.Count -gt 0) {
                        $projectDeps.NodeJSDependencies = @($_.Dependencies | ForEach-Object {
                            @{
                                Name = $_.Name
                                Version = $_.Version
                                Type = if ($_.Name -match "react|vue|angular|svelte") { "Frontend Framework" }
                                      elseif ($_.Name -match "express|fastify|koa|nestjs") { "Backend Framework" }
                                      elseif ($_.Name -match "@types/") { "TypeScript Definitions" }
                                      elseif ($_.Name -match "test|jest|cypress|mocha") { "Testing" }
                                      elseif ($_.Name -match "@paycor") { "Paycor" }
                                      elseif ($_.Name -match "webpack|vite|rollup") { "Build Tools" }
                                      else { "Library" }
                            }
                        })
                    }
                    
                    $projectDeps
                })
                ByCategory = @{
                    NuGetPackages = @{
                        Paycor = @(($Projects | Where-Object { $_.Packages } | ForEach-Object { $_.Packages } | Where-Object { $_.Name -match "Paycor" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        WebFramework = @(($Projects | Where-Object { $_.Packages } | ForEach-Object { $_.Packages } | Where-Object { $_.Name -match "Microsoft\.AspNetCore" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        ORM = @(($Projects | Where-Object { $_.Packages } | ForEach-Object { $_.Packages } | Where-Object { $_.Name -match "Microsoft\.EntityFrameworkCore" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        Cloud = @(($Projects | Where-Object { $_.Packages } | ForEach-Object { $_.Packages } | Where-Object { $_.Name -match "Azure|AWS|Google\.Cloud" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        Testing = @(($Projects | Where-Object { $_.Packages } | ForEach-Object { $_.Packages } | Where-Object { $_.Name -match "Test|Mock|Xunit|NUnit|MSTest" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        Other = @(($Projects | Where-Object { $_.Packages } | ForEach-Object { $_.Packages } | Where-Object { $_.Name -notmatch "Paycor|Microsoft\.AspNetCore|Microsoft\.EntityFrameworkCore|Azure|AWS|Google\.Cloud|Test|Mock|Xunit|NUnit|MSTest" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                    }
                    NodeJSDependencies = @{
                        Paycor = @(($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies } | Where-Object { $_.Name -match "@paycor" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        FrontendFrameworks = @(($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies } | Where-Object { $_.Name -match "react|vue|angular|svelte" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        BackendFrameworks = @(($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies } | Where-Object { $_.Name -match "express|fastify|koa|nestjs" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        TypeScript = @(($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies } | Where-Object { $_.Name -match "@types/|typescript" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        BuildTools = @(($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies } | Where-Object { $_.Name -match "webpack|vite|rollup" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        Testing = @(($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies } | Where-Object { $_.Name -match "test|jest|cypress|mocha" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                        Other = @(($Projects | Where-Object { $_.Dependencies } | ForEach-Object { $_.Dependencies } | Where-Object { $_.Name -notmatch "@paycor|react|vue|angular|svelte|express|fastify|koa|nestjs|@types/|typescript|webpack|vite|rollup|test|jest|cypress|mocha" } | ForEach-Object { "$($_.Name)|$($_.Version)" } | Sort-Object | Get-Unique) | ForEach-Object { $parts = $_ -split "\|"; @{ Name = $parts[0]; Version = $parts[1] } })
                    }
                }
            }
            Metadata = @{
                GeneratedBy = "Universal Repository Documentation Generator"
                GeneratedOn = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                Version = "3.0"
                Features = @(
                    "Multi-language support", 
                    "Paycor component detection", 
                    "Categorized tech stack", 
                    "Application pattern detection",
                    "Automated setup instructions",
                    "Business logic flow analysis",
                    "DTO and class extraction",
                    "Intelligent tag generation"
                )
            }
        }
        
        # Add deep analysis data if available
        if ($BusinessLogicData) {
            $jsonData.BusinessLogic = @{
                EntryPoints = @{
                    Total = $BusinessLogicData.Statistics.TotalEntryPoints
                    Controllers = $BusinessLogicData.EntryPoints.Controllers.Count
                    AzureFunctions = $BusinessLogicData.EntryPoints.AzureFunctions.Count
                    MessageHandlers = $BusinessLogicData.EntryPoints.MessageHandlers.Count
                    BackgroundJobs = $BusinessLogicData.EntryPoints.BackgroundJobs.Count
                    GraphQLResolvers = $BusinessLogicData.EntryPoints.GraphQLResolvers.Count
                    SignalRHubs = $BusinessLogicData.EntryPoints.SignalRHubs.Count
                    gRPCServices = $BusinessLogicData.EntryPoints.gRPCServices.Count
                    Endpoints = $BusinessLogicData.EntryPoints.Endpoints.Count
                }
                DataFlows = @{
                    TotalTraced = $BusinessLogicData.Statistics.TotalDataFlows
                    MaxCallDepth = $BusinessLogicData.Statistics.MaxCallDepth
                }
            }
        }
        
        if ($DTOData) {
            $jsonData.Classes = @{
                Total = $DTOData.TotalClasses
                Categories = $DTOData.Categories
                KeyTypes = @{
                    DTOs = $DTOData.GroupedClasses.DTOs.Count
                    Entities = $DTOData.GroupedClasses.Entities.Count
                    Services = $DTOData.GroupedClasses.Services.Count
                    Controllers = $DTOData.GroupedClasses.Controllers.Count
                    Repositories = $DTOData.GroupedClasses.Repositories.Count
                }
            }
        }
        
        if ($TagData) {
            $jsonData.Tags = @{
                Total = $TagData.TotalTags
                ByCategory = $TagData.TagsByCategory
                AllTags = $TagData.AllTags
                Keywords = $TagData.Keywords
            }
        }
        
        $jsonOutputPath = $OutputPath -replace '\.md$', '.json'
        $jsonData | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonOutputPath -Encoding UTF8
        
        return $jsonOutputPath
    }
    catch {
        Write-Warning "Failed to generate JSON analysis: $($_.Exception.Message)"
        return $null
    }
}

function Generate-UniversalMarkdown {
    param($Projects, $TechStack, $ApplicationPatterns, $BusinessLogicData = $null, $DTOData = $null, $TagData = $null)
    
    $readmeContent = Get-SafeContent (Join-Path $RepositoryPath "README.md")
    $repoName = Split-Path $RepositoryPath -Leaf
    
    # Extract description from README if available
    $description = "A software project with multiple components and dependencies."
    if ($readmeContent) {
        $lines = $readmeContent -split "`n"
        $foundDescription = ""
        $capturing = $false
        foreach ($line in $lines) {
            if ($line -match "^##?\s+.*Purpose|^##?\s+.*Description|^##?\s+.*Overview|^##?\s+.*About") {
                $capturing = $true
                continue
            }
            if ($capturing -and $line -match "^##?\s+") {
                break
            }
            if ($capturing -and $line.Trim()) {
                $foundDescription += $line.Trim() + " "
            }
        }
        if ($foundDescription) { 
            $description = $foundDescription.TrimEnd() 
        } else {
            # Try to get the first substantial paragraph
            foreach ($line in $lines) {
                if ($line.Trim().Length -gt 50 -and $line -notmatch "^#" -and $line -notmatch "^\[" -and $line -notmatch "^!\[") {
                    $description = $line.Trim()
                    break
                }
            }
        }
    }
    
    $content = @"
# $repoName - Repository Instructions

*Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")*

## Overview

$description

## Architecture Overview

This repository contains $(if ($Projects.Count -eq 1) { "a single project" } else { "multiple projects" }) with the following components:

$(foreach ($project in $Projects | Where-Object { -not $_.IsTest }) {
    "- **$($project.Name)** ($($project.Type.ToUpper())): Located at ``$($project.Path)```n"
})

$(if ($Projects | Where-Object { $_.IsTest }) {
    "### Test Projects`n" + 
    (($Projects | Where-Object { $_.IsTest } | ForEach-Object { "- **$($_.Name)** ($($_.Type.ToUpper())): Located at ``$($_.Path)``" }) -join "`n") + "`n"
})

## Tech Stack

$(if ($TechStack.Paycor.Count -gt 0) {
    "### Paycor Components`n" + 
    (($TechStack.Paycor | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
})

$(foreach ($category in @("Backend", "Frontend", "Database", "Caching", "Cloud", "Mobile", "DevTools", "Testing")) {
    if ($TechStack[$category].Count -gt 0) {
        "### $category Technologies`n" + 
        (($TechStack[$category] | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
})

$(if ($TechStack.Other.Count -gt 0) {
    "### Other Dependencies`n" + 
    (($TechStack.Other | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
})

$(# Application Patterns Section
$totalPatterns = ($ApplicationPatterns.AzureFunctions.Count + $ApplicationPatterns.WebAPI.Count + 
                 $ApplicationPatterns.BackgroundWorkers.Count + $ApplicationPatterns.Microservices.Count + 
                 $ApplicationPatterns.EventDriven.Count + $ApplicationPatterns.Authentication.Count + 
                 $ApplicationPatterns.DataAccess.Count + $ApplicationPatterns.Other.Count)
if ($totalPatterns -gt 0) {
    $appPatternsSection = "## 🏗️ Application Patterns`n`n"
    
    if ($ApplicationPatterns.AzureFunctions.Count -gt 0) {
        $appPatternsSection += "### Azure Functions`n" + 
        (($ApplicationPatterns.AzureFunctions | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    if ($ApplicationPatterns.WebAPI.Count -gt 0) {
        $appPatternsSection += "### Web API`n" + 
        (($ApplicationPatterns.WebAPI | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    if ($ApplicationPatterns.BackgroundWorkers.Count -gt 0) {
        $appPatternsSection += "### Background Workers`n" + 
        (($ApplicationPatterns.BackgroundWorkers | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    if ($ApplicationPatterns.Authentication.Count -gt 0) {
        $appPatternsSection += "### Authentication`n" + 
        (($ApplicationPatterns.Authentication | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    if ($ApplicationPatterns.DataAccess.Count -gt 0) {
        $appPatternsSection += "### Data Access`n" + 
        (($ApplicationPatterns.DataAccess | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    if ($ApplicationPatterns.EventDriven.Count -gt 0) {
        $appPatternsSection += "### Event-Driven`n" + 
        (($ApplicationPatterns.EventDriven | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    if ($ApplicationPatterns.Microservices.Count -gt 0) {
        $appPatternsSection += "### Microservices`n" + 
        (($ApplicationPatterns.Microservices | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    if ($ApplicationPatterns.Other.Count -gt 0) {
        $appPatternsSection += "### Other Patterns`n" + 
        (($ApplicationPatterns.Other | Sort-Object | Get-Unique | ForEach-Object { "- $_" }) -join "`n") + "`n`n"
    }
    
    $appPatternsSection
}
)

## Project Structure

``````
$repoName/
$(Get-UniversalDirectoryStructure -Path $RepositoryPath -MaxDepth 3)
``````

## Prerequisites

### Required Software

$(if ($Projects | Where-Object { $_.Type -eq "dotnet" }) {
    $frameworks = $Projects | Where-Object { $_.Type -eq "dotnet" } | ForEach-Object { $_.TargetFramework } | Sort-Object | Get-Unique
    foreach ($framework in $frameworks) {
        if ($framework) {
            "- **.NET SDK** ($framework or later) - Download from [https://dotnet.microsoft.com/download](https://dotnet.microsoft.com/download)`n"
        } else {
            "- **.NET SDK** (latest version) - Download from [https://dotnet.microsoft.com/download](https://dotnet.microsoft.com/download)`n"
        }
    }
})

$(if ($Projects | Where-Object { $_.Type -eq "nodejs" }) {
    "- **Node.js** (version 16+ recommended) - Download from [https://nodejs.org/](https://nodejs.org/)`n" +
    "- **npm** or **yarn** - Package manager for Node.js`n"
})

$(if ($Projects | Where-Object { $_.Type -eq "python" }) {
    "- **Python** (version 3.8+ recommended) - Download from [https://python.org/](https://python.org/)`n" +
    "- **pip** - Python package manager`n"
})

$(if ($Projects | Where-Object { $_.Type -eq "java" }) {
    "- **Java JDK** (version 11+ recommended) - Download from [https://adoptium.net/](https://adoptium.net/)`n" +
    "- **Maven** - Build tool for Java projects`n"
})

### Additional Requirements
- **Git** - For version control
- **IDE/Editor** - Visual Studio Code, Visual Studio, IntelliJ IDEA, or your preferred development environment
$(if ($TechStack.Database.Count -gt 0) {
    "- **Database** - Based on your project's database dependencies`n"
})

## Setup Instructions

### 1. Clone the Repository
``````bash
git clone <repository-url>
cd $repoName
``````

$(Get-SetupInstructions -Projects $Projects)

## Dependencies

$(foreach ($project in $Projects | Where-Object { $_.Type -eq "dotnet" -and $_.Packages.Count -gt 0 }) {
    "### $($project.Name) (.NET Packages)

| Package | Version | Category |
|---------|---------|----------|
$(foreach ($package in $project.Packages | Sort-Object Name) {
    $category = switch -Wildcard ($package.Name.ToLower()) {
        "*azure*" { "Cloud Services" }
        "*aws*" { "Cloud Services" }
        "*test*" { "Testing" }
        "*dapper*" { "Data Access" }
        "*entityframework*" { "ORM/Data Access" }
        "*aspnetcore*" { "Web Framework" }
        "*swagger*" { "API Documentation" }
        "*newtonsoft*" { "JSON Processing" }
        "*automapper*" { "Object Mapping" }
        "*serilog*" { "Logging" }
        "*log*" { "Logging" }
        default { "Application Logic" }
    }
    "| $($package.Name) | $($package.Version) | $category |`n"
})

"
})

$(foreach ($project in $Projects | Where-Object { $_.Type -eq "nodejs" -and $_.Dependencies.Count -gt 0 }) {
    "### $($project.Name) (Node.js Dependencies)

| Package | Version | Category |
|---------|---------|----------|
$(foreach ($dep in $project.Dependencies | Sort-Object Name) {
    $category = switch -Wildcard ($dep.Name.ToLower()) {
        "*react*" { "Frontend Framework" }
        "*vue*" { "Frontend Framework" }
        "*angular*" { "Frontend Framework" }
        "*express*" { "Backend Framework" }
        "*mui*" { "UI Library" }
        "*bootstrap*" { "CSS Framework" }
        "*axios*" { "HTTP Client" }
        "*lodash*" { "Utilities" }
        "*moment*" { "Date/Time" }
        "*typescript*" { "Language" }
        "*webpack*" { "Build Tool" }
        "*vite*" { "Build Tool" }
        "*eslint*" { "Code Quality" }
        "*prettier*" { "Code Formatting" }
        "*test*" { "Testing" }
        "*jest*" { "Testing" }
        default { "Application Logic" }
    }
    "| $($dep.Name) | $($dep.Version) | $category |`n"
})

"
})

## Configuration

### Environment Setup
$(if ($Projects | Where-Object { $_.Type -eq "dotnet" }) {
    "#### .NET Configuration
- Create or update configuration files (``appsettings.json``, ``appsettings.Development.json``)
- Set environment variables as needed
- Configure database connection strings
- Set up authentication and authorization settings`n"
})

$(if ($Projects | Where-Object { $_.Type -eq "nodejs" }) {
    "#### Node.js Configuration
- Create ``.env`` files for environment-specific settings
- Configure API endpoints and external service URLs
- Set up build and deployment configurations`n"
})

## Development Workflow

### Getting Started
1. **Clone and setup:** Follow the setup instructions above
2. **Install dependencies:** Run package restore/install commands
3. **Configure:** Update configuration files with your environment settings
4. **Run:** Start the development servers
5. **Develop:** Make your changes and test locally

### Common Commands
$(if ($Projects | Where-Object { $_.Type -eq "dotnet" }) {
    "#### .NET Commands
``````bash
dotnet restore     # Restore NuGet packages
dotnet build       # Build the solution
dotnet run         # Run the application
dotnet test        # Run unit tests
dotnet publish     # Publish for deployment
``````
"
})

$(if ($Projects | Where-Object { $_.Type -eq "nodejs" }) {
    "#### Node.js Commands
``````bash
npm install        # Install dependencies
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run lint       # Run code linting
``````
"
})

## Testing

$(if ($Projects | Where-Object { $_.IsTest -or $_.Type -eq "nodejs" }) {
    "### Running Tests

$(if ($Projects | Where-Object { $_.Type -eq "dotnet" -and $_.IsTest }) {
    "**Backend Tests:**
``````bash
dotnet test
``````
"
})

$(if ($Projects | Where-Object { $_.Type -eq "nodejs" }) {
    "**Frontend/Node.js Tests:**
``````bash
npm test
``````
"
})
"
} else {
    "Testing framework setup is recommended. Consider adding:
- Unit tests for core functionality
- Integration tests for APIs and services
- End-to-end tests for user workflows"
})

## Troubleshooting

### Common Issues

1. **Build Failures:**
   - Ensure all prerequisites are installed with correct versions
   - Clear build caches (``dotnet clean``, delete ``node_modules``)
   - Check for version conflicts in dependencies

2. **Runtime Errors:**
   - Verify configuration files are properly set up
   - Check database connectivity (if applicable)
   - Ensure all required services are running

3. **Package/Dependency Issues:**
   - Update package managers (``npm install -g npm@latest``)
   - Clear package caches
   - Check for deprecated packages and update

4. **Port Conflicts:**
   - Check if required ports are available
   - Update configuration to use different ports
   - Stop conflicting services

## Additional Resources

- [Git Documentation](https://git-scm.com/doc)
$(if ($Projects | Where-Object { $_.Type -eq "dotnet" }) {
    "- [.NET Documentation](https://docs.microsoft.com/en-us/dotnet/)`n"
})
$(if ($Projects | Where-Object { $_.Type -eq "nodejs" }) {
    "- [Node.js Documentation](https://nodejs.org/en/docs/)`n"
})
$(if ($TechStack.Frontend | Where-Object { $_ -like "*react*" }) {
    "- [React Documentation](https://reactjs.org/docs/)`n"
})
$(if ($TechStack.Frontend | Where-Object { $_ -like "*vue*" }) {
    "- [Vue.js Documentation](https://vuejs.org/guide/)`n"
})
$(if ($TechStack.Frontend | Where-Object { $_ -like "*angular*" }) {
    "- [Angular Documentation](https://angular.io/docs)`n"
})

---

*This documentation was automatically generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss"). For updates, re-run the documentation generator script.*
"@

    # Append additional sections if data is available
    if ($TagData) {
        $content += "`n`n## Repository Tags`n`n"
        $content += "This repository has been analyzed and tagged with the following characteristics:`n`n"
        $content += "### Technical Tags`n"
        $allTechTags = $TagData.TagsByCategory.Frameworks + $TagData.TagsByCategory.Architecture + $TagData.TagsByCategory.Cloud + $TagData.TagsByCategory.Database + $TagData.TagsByCategory.ApplicationType + $TagData.TagsByCategory.Quality | Where-Object { $_ } | Sort-Object -Unique
        foreach ($tag in $allTechTags) {
            $content += "- $tag`n"
        }
        $content += "`n### Business Domain Tags`n"
        foreach ($tag in $TagData.TagsByCategory.BusinessDomain) {
            $content += "- $tag`n"
        }
        $content += "`n### Search Keywords`n"
        $content += "``" + ($TagData.AllTags -join ", ") + "```n`n"
    }
    
    if ($BusinessLogicData) {
        $content += "`n`n## Business Logic Entry Points`n`n"
        $content += "This repository contains the following entry points for business logic:`n`n"
        $content += "### Summary Statistics`n"
        $content += "- **Total Entry Points:** $($BusinessLogicData.Statistics.TotalEntryPoints)`n"
        $content += "- **Controllers:** $($BusinessLogicData.EntryPoints.Controllers.Count)`n"
        $content += "- **Azure Functions:** $($BusinessLogicData.EntryPoints.AzureFunctions.Count)`n"
        $content += "- **Message Handlers:** $($BusinessLogicData.EntryPoints.MessageHandlers.Count)`n"
        $content += "- **Background Jobs:** $($BusinessLogicData.EntryPoints.BackgroundJobs.Count)`n"
        $content += "- **Data Flows Traced:** $($BusinessLogicData.Statistics.TotalDataFlows)`n"
        $content += "- **Maximum Call Depth:** $($BusinessLogicData.Statistics.MaxCallDepth)`n`n"
        $content += "### Key Entry Points`n`n"
        
        if ($BusinessLogicData.EntryPoints.Controllers.Count -gt 0) {
            $content += "#### Controllers`n"
            foreach ($controller in ($BusinessLogicData.EntryPoints.Controllers | Select-Object -First 10)) {
                $content += "- **$($controller.Name)** - $($controller.Endpoints.Count) endpoint(s) in ``$($controller.File)```n"
            }
            $content += "`n"
        }
        
        if ($BusinessLogicData.EntryPoints.AzureFunctions.Count -gt 0) {
            $content += "#### Azure Functions`n"
            foreach ($func in ($BusinessLogicData.EntryPoints.AzureFunctions | Select-Object -First 10)) {
                $content += "- **$($func.Name)** ($($func.TriggerType) trigger) in ``$($func.File)```n"
            }
            $content += "`n"
        }
        
        if ($BusinessLogicData.EntryPoints.MessageHandlers.Count -gt 0) {
            $content += "#### Message Handlers`n"
            foreach ($handler in ($BusinessLogicData.EntryPoints.MessageHandlers | Select-Object -First 10)) {
                $content += "- **$($handler.Name)** - Handles ``$($handler.MessageType)`` in ``$($handler.File)```n"
            }
            $content += "`n"
        }
        
        $content += "*For complete business logic flow analysis, see ``BUSINESS_LOGIC_FLOWS.md``*`n"
    }
    
    if ($DTOData) {
        $content += "`n`n## Key DTOs and Classes`n`n"
        $content += "This repository contains $($DTOData.TotalClasses) classes across various categories:`n`n"
        $content += "### Category Breakdown`n"
        foreach ($category in ($DTOData.Categories.Keys | Sort-Object)) {
            $content += "- **$category**: $($DTOData.Categories[$category]) class(es)`n"
        }
        $content += "`n### Sample DTOs`n`n"
        
        if ($DTOData.GroupedClasses.DTOs.Count -gt 0) {
            foreach ($dto in ($DTOData.GroupedClasses.DTOs | Select-Object -First 5)) {
                $content += "#### $($dto.Name)`n"
                $content += "**Namespace:** ``$($dto.Namespace)```n"
                $content += "**Properties:** $($dto.Properties.Count)`n"
                if ($dto.Properties.Count -gt 0) {
                    $keyFields = ($dto.Properties | Select-Object -First 5 | ForEach-Object { "``$($_.Name)`` ($($_.Type))" }) -join ", "
                    $content += "**Key Fields:** $keyFields`n"
                }
                $content += "`n"
            }
        }
        
        $content += "*For complete class catalog, see ``CLASS_CATALOG.md``*`n"
    }

    return $content
}

# C# Source Code Analysis Function
function Analyze-CSharpSourcePatterns {
    param($appPatterns)
    
    Write-Host "🔍 Analyzing C# source files for application patterns..." -ForegroundColor Gray
    
    # Find all C# source files
    $csFiles = Get-ChildItem -Path $RepositoryPath -Recurse -Filter "*.cs" -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notmatch "\\(bin|obj|node_modules|\\.git)\\" }
    
    foreach ($file in $csFiles) {
        try {
            $content = Get-Content $file.FullName -Raw -ErrorAction Stop
            if (-not $content) { continue }
            
            # Azure Functions patterns
            if ($content -match "\[FunctionName\]|\[Function\]") { $appPatterns.AzureFunctions += "Function Attributes" }
            if ($content -match "IDurableOrchestrationContext|IDurableActivityContext") { $appPatterns.AzureFunctions += "Durable Functions Context" }
            if ($content -match "\[OrchestrationTrigger\]|\[ActivityTrigger\]") { $appPatterns.AzureFunctions += "Durable Function Triggers" }
            if ($content -match "\[HttpTrigger\]|\[TimerTrigger\]|\[BlobTrigger\]|\[QueueTrigger\]") { $appPatterns.AzureFunctions += "Function Triggers" }
            
            # Web API patterns
            if ($content -match "\[ApiController\]|ControllerBase|Controller") { $appPatterns.WebAPI += "API Controllers" }
            if ($content -match "\[HttpGet\]|\[HttpPost\]|\[HttpPut\]|\[HttpDelete\]") { $appPatterns.WebAPI += "HTTP Action Methods" }
            if ($content -match "\[Route\]|\[ApiVersion\]") { $appPatterns.WebAPI += "API Routing" }
            if ($content -match "IActionResult|ActionResult") { $appPatterns.WebAPI += "Action Results" }
            
            # Background Workers
            if ($content -match "BackgroundService|IHostedService") { $appPatterns.BackgroundWorkers += "Background Services" }
            if ($content -match "ExecuteAsync|StartAsync|StopAsync") { $appPatterns.BackgroundWorkers += "Hosted Service Methods" }
            if ($content -match "IServiceScope|CreateScope") { $appPatterns.BackgroundWorkers += "Scoped Services" }
            
            # Authentication patterns
            if ($content -match "\[Authorize\]|\[AllowAnonymous\]") { $appPatterns.Authentication += "Authorization Attributes" }
            if ($content -match "ClaimsPrincipal|ClaimsIdentity|Claims") { $appPatterns.Authentication += "Claims-based Auth" }
            if ($content -match "JwtSecurityToken|JWT") { $appPatterns.Authentication += "JWT Authentication" }
            if ($content -match "IIdentityService|IAuthenticationService") { $appPatterns.Authentication += "Authentication Services" }
            
            # Data Access patterns
            if ($content -match "DbContext|IDbContext") { $appPatterns.DataAccess += "Entity Framework DbContext" }
            if ($content -match "IRepository|Repository") { $appPatterns.DataAccess += "Repository Pattern" }
            if ($content -match "IUnitOfWork|UnitOfWork") { $appPatterns.DataAccess += "Unit of Work Pattern" }
            if ($content -match "\[Table\]|\[Column\]|\[Key\]") { $appPatterns.DataAccess += "Data Annotations" }
            
            # Caching patterns
            if ($content -match "IMemoryCache|MemoryCache") { $appPatterns.Other += "In-Memory Caching" }
            if ($content -match "IDistributedCache|DistributedCache") { $appPatterns.Other += "Distributed Caching" }
            if ($content -match "IDatabase.*Redis|ConnectionMultiplexer") { $appPatterns.Other += "Redis Caching" }
            if ($content -match "\[ResponseCache\]|ResponseCacheAttribute") { $appPatterns.Other += "Response Caching" }
            
            # Event-driven patterns
            if ($content -match "INotificationHandler|IRequestHandler") { $appPatterns.EventDriven += "MediatR Handlers" }
            if ($content -match "IIntegrationEvent|IDomainEvent") { $appPatterns.EventDriven += "Domain/Integration Events" }
            if ($content -match "EventBus|IEventBus") { $appPatterns.EventDriven += "Event Bus Pattern" }
            if ($content -match "ServiceBusMessage|EventData") { $appPatterns.EventDriven += "Message Types" }
            
            # Microservices patterns
            if ($content -match "IHealthCheck|HealthCheck") { $appPatterns.Microservices += "Health Checks" }
            if ($content -match "ICircuitBreaker|CircuitBreaker") { $appPatterns.Microservices += "Circuit Breaker" }
            if ($content -match "IRetryPolicy|RetryPolicy") { $appPatterns.Microservices += "Retry Policies" }
            if ($content -match "IServiceDiscovery|ServiceDiscovery") { $appPatterns.Microservices += "Service Discovery" }
            if ($content -match "IApiGateway|ApiGateway") { $appPatterns.Microservices += "API Gateway" }
            
        } catch {
            Write-Debug "Skipped C# file analysis: $($file.FullName) - $($_.Exception.Message)"
        }
    }
}

# Main execution
try {
    # Deep analysis enables all additional analyses
    if ($DeepAnalysis) {
        $IncludeBusinessLogic = $true
        $IncludeDTOs = $true
        $IncludeTags = $true
    }
    
    Write-Host "🔍 Analyzing projects..." -ForegroundColor Yellow
    $projects = Analyze-UniversalProjects
    
    Write-Host "🔍 Analyzing tech stack and application patterns..." -ForegroundColor Yellow
    $analysisResult = Analyze-UniversalTechStack -Projects $projects
    $techStack = $analysisResult.TechStack
    $appPatterns = $analysisResult.ApplicationPatterns
    
    # Add C# source code pattern analysis
    Analyze-CSharpSourcePatterns -appPatterns $appPatterns
    
    # Run additional analyses if requested
    $businessLogicData = $null
    $dtoData = $null
    $tagData = $null
    
    if ($IncludeBusinessLogic) {
        Write-Host "🔍 Analyzing business logic flows..." -ForegroundColor Yellow
        $businessLogicScript = Join-Path $PSScriptRoot "Analyze-BusinessLogic.ps1"
        if (Test-Path $businessLogicScript) {
            $businessLogicData = & $businessLogicScript -RepositoryPath $RepositoryPath
            Write-Host "   Found $($businessLogicData.Statistics.TotalEntryPoints) entry points" -ForegroundColor Gray
        } else {
            Write-Warning "Business logic analyzer not found at: $businessLogicScript"
        }
    }
    
    if ($IncludeDTOs) {
        Write-Host "� Extracting DTOs and key classes..." -ForegroundColor Yellow
        $dtoScript = Join-Path $PSScriptRoot "Extract-DTOsAndClasses.ps1"
        if (Test-Path $dtoScript) {
            $dtoData = & $dtoScript -RepositoryPath $RepositoryPath
            Write-Host "   Found $($dtoData.TotalClasses) classes" -ForegroundColor Gray
        } else {
            Write-Warning "DTO extractor not found at: $dtoScript"
        }
    }
    
    if ($IncludeTags) {
        Write-Host "🔍 Generating intelligent tags..." -ForegroundColor Yellow
        $tagScript = Join-Path $PSScriptRoot "Generate-RepositoryTags.ps1"
        if (Test-Path $tagScript) {
            $tagData = & $tagScript -RepositoryPath $RepositoryPath
            Write-Host "   Generated $($tagData.TotalTags) tags" -ForegroundColor Gray
        } else {
            Write-Warning "Tag generator not found at: $tagScript"
        }
    }
    
    Write-Host "�📝 Generating markdown content..." -ForegroundColor Yellow
    $markdownContent = Generate-UniversalMarkdown -Projects $projects -TechStack $techStack -ApplicationPatterns $appPatterns -BusinessLogicData $businessLogicData -DTOData $dtoData -TagData $tagData
    
    Write-Host "💾 Writing markdown file..." -ForegroundColor Yellow
    $markdownContent | Out-File -FilePath $OutputPath -Encoding UTF8
    
    $jsonPath = $null
    if ($JsonOutput) {
        Write-Host "📊 Generating JSON analysis..." -ForegroundColor Yellow
        $jsonPath = Export-JsonAnalysis -Projects $projects -TechStack $techStack -ApplicationPatterns $appPatterns -RepositoryPath $RepositoryPath -OutputPath $OutputPath -BusinessLogicData $businessLogicData -DTOData $dtoData -TagData $tagData
    }
    
    Write-Host "✅ Universal documentation generated successfully!" -ForegroundColor Green
    Write-Host "📄 Markdown: $OutputPath" -ForegroundColor Cyan
    if ($jsonPath) {
        Write-Host "📊 JSON: $jsonPath" -ForegroundColor Cyan
    }
    Write-Host "📊 Analyzed $($projects.Count) projects:" -ForegroundColor Cyan
    
    $projectTypes = $projects | Group-Object Type | ForEach-Object { "$($_.Count) $($_.Name)" }
    Write-Host "   - $($projectTypes -join ', ')" -ForegroundColor Gray
    
} catch {
    Write-Error "Failed to generate documentation: $($_.Exception.Message)"
    exit 1
}