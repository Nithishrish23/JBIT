<#
Simple smoke test script for key endpoints.
Run from repository root in PowerShell.
It logs in as admin and user (admin@example.com/admin123) and tests endpoints.
#>

param(
    [int]$OrderId = 1
)

$base = 'http://127.0.0.1:5000'

function Login($email, $password){
    try{
        $res = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{email=$email; password=$password} | ConvertTo-Json)
        return $res.access_token
    } catch {
        Write-Host "Login failed for $email: $_" -ForegroundColor Red
        return $null
    }
}

Write-Host "Starting smoke tests against $base"
$adminToken = Login 'admin@example.com' 'admin123'
if(-not $adminToken){ Write-Host 'Cannot continue without admin token' -ForegroundColor Red; exit 1 }

Write-Host "Testing /api/admin/dashboard"
try{ Invoke-RestMethod -Uri "$base/api/admin/dashboard" -Headers @{ Authorization = "Bearer $adminToken" } -Method Get; Write-Host 'OK' -ForegroundColor Green } catch { Write-Host "FAIL: $_" -ForegroundColor Red }

Write-Host "Testing listing seller requests"
try{ Invoke-RestMethod -Uri "$base/api/admin/seller-requests" -Headers @{ Authorization = "Bearer $adminToken" } -Method Get; Write-Host 'OK' -ForegroundColor Green } catch { Write-Host "FAIL: $_" -ForegroundColor Red }

# Test order endpoints (requires an order to exist). Use admin token for broad access.
Write-Host "Testing /order/$OrderId"
try{ Invoke-RestMethod -Uri "$base/order/$OrderId" -Headers @{ Authorization = "Bearer $adminToken" } -Method Get; Write-Host 'OK' -ForegroundColor Green } catch { Write-Host "FAIL: $_" -ForegroundColor Yellow }

Write-Host "Testing /order/$OrderId/track"
try{ Invoke-RestMethod -Uri "$base/order/$OrderId/track" -Headers @{ Authorization = "Bearer $adminToken" } -Method Get; Write-Host 'OK' -ForegroundColor Green } catch { Write-Host "FAIL: $_" -ForegroundColor Yellow }

Write-Host "Testing /order/$OrderId/invoice"
try{ $r = Invoke-RestMethod -Uri "$base/order/$OrderId/invoice" -Headers @{ Authorization = "Bearer $adminToken" } -Method Get -ErrorAction Stop; if($r){ Write-Host 'OK (received HTML)' -ForegroundColor Green } } catch { Write-Host "FAIL: $_" -ForegroundColor Yellow }

Write-Host "Smoke tests complete"