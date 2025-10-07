# Verification - Run this in PowerShell to confirm changes are in source

Write-Host "`n=== Verifying Source Code Changes ===" -ForegroundColor Cyan

# Check for date filling logic
Write-Host "`n1. Checking for date gap filling logic..." -ForegroundColor Yellow
$dateLogic = Select-String -Path "src\components\charts\TimelineChart.tsx" -Pattern "while \(currentDate <= endDate\)"
if ($dateLogic) {
    Write-Host "   ✓ Date gap filling logic FOUND in source" -ForegroundColor Green
} else {
    Write-Host "   ✗ Date gap filling logic NOT FOUND" -ForegroundColor Red
}

# Check for lost game detection
Write-Host "`n2. Checking for lost game detection..." -ForegroundColor Yellow
$lostLogic = Select-String -Path "src\extension\content\wordleBotContent.ts" -Pattern "isLost.*=.*steps.*===.*'-'"
if ($lostLogic) {
    Write-Host "   ✓ Lost game detection FOUND in source" -ForegroundColor Green
} else {
    Write-Host "   ✗ Lost game detection NOT FOUND" -ForegroundColor Red
}

# Check if dist directory exists
Write-Host "`n3. Checking dist directory..." -ForegroundColor Yellow
if (Test-Path "dist") {
    $files = Get-ChildItem -Path "dist" -File -Recurse | Measure-Object
    Write-Host "   ✓ dist directory exists with $($files.Count) files" -ForegroundColor Green
    
    # Check dashboard.js age
    if (Test-Path "dist\dashboard.js") {
        $dashboardAge = (Get-Item "dist\dashboard.js").LastWriteTime
        $ageMinutes = ((Get-Date) - $dashboardAge).TotalMinutes
        if ($ageMinutes -lt 5) {
            Write-Host "   ✓ dashboard.js was built $([math]::Round($ageMinutes, 1)) minutes ago (RECENT)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠ dashboard.js was built $([math]::Round($ageMinutes, 1)) minutes ago (MAY NEED REBUILD)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ✗ dashboard.js NOT FOUND in dist" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ dist directory does NOT exist - need to build!" -ForegroundColor Red
}

Write-Host "`n=== Recommendations ===" -ForegroundColor Cyan

if ($dateLogic -and $lostLogic) {
    Write-Host "✓ Source code has all changes" -ForegroundColor Green
    
    if (Test-Path "dist\dashboard.js") {
        $dashboardAge = (Get-Item "dist\dashboard.js").LastWriteTime
        $ageMinutes = ((Get-Date) - $dashboardAge).TotalMinutes
        
        if ($ageMinutes -gt 5) {
            Write-Host "`n⚠ NEXT STEP: Rebuild the extension" -ForegroundColor Yellow
            Write-Host "   Run: npm run build:extension" -ForegroundColor White
            Write-Host "   Or:  node quick-build-extension.js" -ForegroundColor White
        } else {
            Write-Host "`n✓ Build is recent!" -ForegroundColor Green
            Write-Host "`nNEXT STEPS:" -ForegroundColor Yellow
            Write-Host "  1. Go to chrome://extensions/" -ForegroundColor White
            Write-Host "  2. Click RELOAD on Wordle Stats Extension" -ForegroundColor White
            Write-Host "  3. Re-scrape data from WordleBot" -ForegroundColor White
            Write-Host "  4. View dashboard and verify changes" -ForegroundColor White
        }
    } else {
        Write-Host "`n⚠ NEXT STEP: Build the extension" -ForegroundColor Yellow
        Write-Host "   Run: npm run build:extension" -ForegroundColor White
    }
} else {
    Write-Host "✗ Source code is missing changes - something went wrong!" -ForegroundColor Red
}

Write-Host ""
