# PowerShell script to apply specific logging to all controllers
# This script adds ControllerLogger imports and specific logging methods

$controllerMappings = @{
    "branches.controller.ts" = "logBranchData"
    "customer.controller.ts" = "logCustomerData"
    "customerCategory.controller.ts" = "logCustomerCategoryData"
    "dealSlip.controller.ts" = "logDealSlipData"
    "dumpRegister.controller.ts" = "logDumpRegisterData"
    "farmer.controller.ts" = "logFarmerData"
    "inwardRegister.controller.ts" = "logInwardRegisterData"
    "labor.controller.ts" = "logLabourData"
    "labourAttendances.controller.ts" = "logLabourAttendanceData"
    "labourPaymentVoucher.controller.ts" = "logLabourPaymentVoucherData"
    "multiCashVoucher.controller.ts" = "logMultiCashVoucherData"
    "offices.controller.ts" = "logOfficeData"
    "product.controller.ts" = "logProductData"
    "productCategory.controller.ts" = "logProductCategoryData"
    "rfpa.controller.ts" = "logRfpaData"
    "secondSale.controller.ts" = "logSecondSaleData"
    "transportPaymentV.controller.ts" = "logTransportPaymentVoucherData"
    "UOM.controller.ts" = "logUomData"
    "user.controller.ts" = "logUserData"
    "vehicleDispatch.controller.ts" = "logVehicleDispatchData"
    "vendor.controller.ts" = "logVendorData"
    "vendorCategory.controller.ts" = "logVendorCategoryData"
}

Write-Host "🚀 Starting specific logging application..." -ForegroundColor Green
Write-Host ""

$successCount = 0
$skipCount = 0
$errorCount = 0

foreach ($controller in $controllerMappings.Keys) {
    $path = "src/controllers/$controller"
    $logMethod = $controllerMappings[$controller]
    
    Write-Host "Processing $controller..." -ForegroundColor Yellow
    
    if (Test-Path $path) {
        try {
            $content = Get-Content $path -Raw -ErrorAction Stop
            $lines = Get-Content $path -ErrorAction Stop
            $modified = $false
            
            # Step 1: Add ControllerLogger import if not exists
            if ($content -notmatch "ControllerLogger") {
                Write-Host "  📦 Adding ControllerLogger import..." -ForegroundColor Cyan
                
                $insertIndex = -1
                for ($i = 0; $i -lt $lines.Length; $i++) {
                    if ($lines[$i] -match "^import.*logger.*") {
                        $insertIndex = $i + 1
                        break
                    }
                }
                
                if ($insertIndex -eq -1) {
                    for ($i = 0; $i -lt $lines.Length; $i++) {
                        if ($lines[$i] -match "^import.*") {
                            $insertIndex = $i + 1
                        }
                    }
                }
                
                if ($insertIndex -ne -1) {
                    $newLines = @()
                    $newLines += $lines[0..($insertIndex-1)]
                    $newLines += "import { ControllerLogger } from '../utils/controllerLogger';"
                    if ($insertIndex -lt $lines.Length) {
                        $newLines += $lines[$insertIndex..($lines.Length-1)]
                    }
                    $lines = $newLines
                    $modified = $true
                }
            }
            
            # Step 2: Find GET methods and add specific logging
            $inGetMethod = $false
            $methodBraceCount = 0
            $foundResStatus = $false
            
            for ($i = 0; $i -lt $lines.Length; $i++) {
                $line = $lines[$i]
                
                # Detect start of GET method
                if ($line -match "@httpGet\s*\(\s*['\"`]?/?['\"`]?\s*\)" -and $i + 1 -lt $lines.Length) {
                    $nextLine = $lines[$i + 1]
                    if ($nextLine -match "public\s+async\s+\w+.*getAlll?\w*") {
                        $inGetMethod = $true
                        $methodBraceCount = 0
                        $foundResStatus = $false
                        Write-Host "  🔍 Found GET method at line $($i + 2)" -ForegroundColor Cyan
                    }
                }
                
                if ($inGetMethod) {
                    # Count braces to track method scope
                    $openBraces = ($line -split '\{').Length - 1
                    $closeBraces = ($line -split '\}').Length - 1
                    $methodBraceCount += $openBraces - $closeBraces
                    
                    # Look for res.status(200).json pattern
                    if ($line -match "res\.status\s*\(\s*200\s*\)\.json\s*\(" -and !$foundResStatus) {
                        # Check if logging already exists in previous lines
                        $hasLogging = $false
                        for ($j = [Math]::Max(0, $i - 5); $j -lt $i; $j++) {
                            if ($lines[$j] -match "ControllerLogger\.$logMethod") {
                                $hasLogging = $true
                                break
                            }
                        }
                        
                        if (!$hasLogging) {
                            Write-Host "  ✨ Adding $logMethod logging before res.status..." -ForegroundColor Green
                            
                            # Insert logging before res.status line
                            $indent = ""
                            if ($line -match "^(\s*)") {
                                $indent = $matches[1]
                            }
                            
                            $loggingLine = "$indent// Log successful retrieval with specific message"
                            $loggingCall = "$indent" + "ControllerLogger.$logMethod(req, res);"
                            $emptyLine = ""
                            
                            $newLines = @()
                            $newLines += $lines[0..($i-1)]
                            $newLines += $loggingLine
                            $newLines += $loggingCall
                            $newLines += $emptyLine
                            $newLines += $lines[$i..($lines.Length-1)]
                            $lines = $newLines
                            $modified = $true
                            $i += 3  # Skip the lines we just added
                        }
                        $foundResStatus = $true
                    }
                    
                    # End of method detection
                    if ($methodBraceCount -le 0 -and $line -match '\}') {
                        $inGetMethod = $false
                    }
                }
            }
            
            # Save changes if modified
            if ($modified) {
                Set-Content $path $lines -Encoding UTF8
                Write-Host "  ✅ Successfully updated $controller" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "  ℹ️  No changes needed for $controller" -ForegroundColor Cyan
                $skipCount++
            }
            
        } catch {
            Write-Host "  ❌ Error processing $controller`: $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    } else {
        Write-Host "  ❌ Controller not found: $controller" -ForegroundColor Red
        $errorCount++
    }
    
    Write-Host ""
}

Write-Host "📊 Summary:" -ForegroundColor Blue
Write-Host "   ✅ Successfully updated: $successCount" -ForegroundColor Green
Write-Host "   ℹ️  No changes needed: $skipCount" -ForegroundColor Cyan
Write-Host "   ❌ Errors: $errorCount" -ForegroundColor Red
Write-Host ""

if ($successCount -gt 0) {
    Write-Host "🎉 Specific logging applied successfully!" -ForegroundColor Green
    Write-Host "Now you should see messages like:" -ForegroundColor Yellow
    Write-Host "   • 'Deal Slip data retrieved successfully'" -ForegroundColor White
    Write-Host "   • 'RFPA data retrieved successfully'" -ForegroundColor White
    Write-Host "   • 'Customer data retrieved successfully'" -ForegroundColor White
    Write-Host "   • etc." -ForegroundColor White
} else {
    Write-Host "⚠️  No controllers were updated. Check the logs above for details." -ForegroundColor Yellow
}