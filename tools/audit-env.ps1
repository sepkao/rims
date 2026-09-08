param(
  [switch]$Fix,
  [ValidateRange(1, 100)]
  [int]$PoolMax
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$apiEnvPath = Join-Path $repoRoot 'apps/api/.env'
$customerEnvPath = Join-Path $repoRoot 'apps/customer/.env'

$serverOnlyKeys = @(
  'DATABASE_URL',
  'SESSION_SECRET',
  'CORS_ALLOWED_ORIGINS',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
)

function Read-EnvFile([string]$Path) {
  $result = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path)) { return $result }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#') -or $trimmed -notmatch '=') { continue }
    $parts = $trimmed -split '=', 2
    $result[$parts[0]] = $parts[1]
  }
  return $result
}

function Write-EnvFile([string]$Path, $Values) {
  $lines = foreach ($entry in $Values.GetEnumerator()) {
    '{0}={1}' -f $entry.Key, $entry.Value
  }
  [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

$apiEnv = Read-EnvFile $apiEnvPath
$customerEnv = Read-EnvFile $customerEnvPath
$misplaced = @($serverOnlyKeys | Where-Object { $customerEnv.Contains($_) })

if ($Fix -and $misplaced.Count -gt 0) {
  foreach ($key in $misplaced) {
    if (-not $apiEnv.Contains($key) -or [string]::IsNullOrWhiteSpace($apiEnv[$key])) {
      $apiEnv[$key] = $customerEnv[$key]
    }
    $customerEnv.Remove($key)
  }
  Write-EnvFile $apiEnvPath $apiEnv
  Write-EnvFile $customerEnvPath $customerEnv
  $misplaced = @()
  Write-Output 'Fixed local .env placement without printing secret values.'
}

if ($Fix) {
  if ($PoolMax) {
    $apiEnv['DB_POOL_MAX'] = [string]$PoolMax
  } elseif (-not $apiEnv.Contains('DB_POOL_MAX')) {
    $apiEnv['DB_POOL_MAX'] = '10'
  }
  if (-not $apiEnv.Contains('DB_CONNECT_TIMEOUT_MS')) { $apiEnv['DB_CONNECT_TIMEOUT_MS'] = '5000' }
  Write-EnvFile $apiEnvPath $apiEnv
}

$requiredApiKeys = @('DATABASE_URL', 'SESSION_SECRET')
$missingApi = @($requiredApiKeys | Where-Object {
  -not $apiEnv.Contains($_) -or [string]::IsNullOrWhiteSpace($apiEnv[$_])
})
$missingCustomer = @('VITE_API_URL' | Where-Object {
  -not $customerEnv.Contains($_) -or [string]::IsNullOrWhiteSpace($customerEnv[$_])
})

Write-Output ('API required variables: {0}' -f $(if ($missingApi.Count) { 'MISSING ' + ($missingApi -join ', ') } else { 'OK' }))
Write-Output ('Customer required variables: {0}' -f $(if ($missingCustomer.Count) { 'MISSING ' + ($missingCustomer -join ', ') } else { 'OK' }))
Write-Output ('Server-only variables in customer env: {0}' -f $(if ($misplaced.Count) { $misplaced -join ', ' } else { 'none' }))
Write-Output ('API performance variables: {0}' -f $(if ($apiEnv.Contains('DB_POOL_MAX') -and $apiEnv.Contains('DB_CONNECT_TIMEOUT_MS')) { 'OK' } else { 'using code defaults' }))

if ($missingApi.Count -or $missingCustomer.Count -or $misplaced.Count) { exit 1 }
exit 0
