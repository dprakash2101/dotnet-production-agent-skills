$ErrorActionPreference = "Stop"
$cli = Join-Path $PSScriptRoot "../dist/src/cli.js"

if (-not (Test-Path $cli -PathType Leaf)) {
    Write-Error "CLI is not built; run 'npm install' and 'npm run build' in the repository"
    exit 1
}

& node $cli install @args
exit $LASTEXITCODE
