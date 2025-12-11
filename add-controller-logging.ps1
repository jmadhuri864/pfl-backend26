# PowerShell script to add ControllerLogger import to all controllers
# Run this script from the project root directory

$controllers = @(
    "branches.controller.ts",
    "customerCategory.controller.ts", 
    "customerSubCategory.controller.ts",
    "customerType.controller.ts",
    "dealSlip.controller.ts",
    "dumpRegister.controller.ts",
    "eodStock.controller.ts",
    "farmer.controller.ts",
    "inwardRegister.controller.ts",
    "labor.controller.ts",
    "labourAttendances.controller.ts",
    "labourPaymentVoucher.controller.ts",
    "labourRegister.controller.ts",
    "multiCashVoucher.controller.ts",
    "offices.controller.ts",
    "otherDeliveryChallan.controller.ts",
    "stockTransferDeliveryChallan.controller.ts",
    "customerDeliveryChallan.controller.ts",
    "pmpVoucher.controller.ts",
    "product.controller.ts",
    "productCategory.controller.ts",
    "productClassification.controller.ts",
    "productSubCategory.controller.ts",
    "rfpa.controller.ts",
    "secondSale.controller.ts",
    "transportPaymentVoucher.controller.ts",
    "uom.controller.ts",
    "uomConversionMatrix.controller.ts",
    "user.controller.ts",
    "vehicleDispatch.controller.ts",
    "vendor.controller.ts",
    "vendorCategory.controller.ts",
    "vendorSubCategory.controller.ts"
)

Write-Host "🚀 Starting ControllerLogger import addition..." -ForegroundColor Green
Write-Host ""

$successCount = 0
$alreadyExistsCount = 0
$notFoundCount = 0

foreach ($controller in $controllers) {
    $path = "src/controllers/$controller"
    
    if (Test-Path $path) {
        $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
        
        if ($content -and $content -notmatch "ControllerLogger") {
            # Find the position to insert the import (after existing imports)
            $lines = Get-Content $path
            $insertIndex = -1
            
            for ($i = 0; $i -lt $lines.Length; $i++) {
                if ($lines[$i] -match "^import.*from.*logger.*") {
                    $insertIndex = $i + 1
                    break
                }
            }
            
            if ($insertIndex -eq -1) {
                # If no logger import found, look for any import statement
                for ($i = 0; $i -lt $lines.Length; $i++) {
                    if ($lines[$i] -match "^import.*") {
                        $insertIndex = $i + 1
                    }
                }
            }
            
            if ($insertIndex -ne -1) {
                # Insert the ControllerLogger import
                $newLines = @()
                $newLines += $lines[0..($insertIndex-1)]
                $newLines += "import { ControllerLogger } from '../utils/controllerLogger';"
                if ($insertIndex -lt $lines.Length) {
                    $newLines += $lines[$insertIndex..($lines.Length-1)]
                }
                
                Set-Content $path $newLines -Encoding UTF8
                Write-Host "✅ Added ControllerLogger import to $controller" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "⚠️  Could not find import section in $controller" -ForegroundColor Yellow
            }
        } else {
            Write-Host "ℹ️  ControllerLogger already imported in $controller" -ForegroundColor Cyan
            $alreadyExistsCount++
        }
    } else {
        Write-Host "❌ Controller not found: $controller" -ForegroundColor Red
        $notFoundCount++
    }
}

Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Blue
Write-Host "   ✅ Successfully added imports: $successCount" -ForegroundColor Green
Write-Host "   ℹ️  Already had imports: $alreadyExistsCount" -ForegroundColor Cyan
Write-Host "   ❌ Controllers not found: $notFoundCount" -ForegroundColor Red
Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Add @request() req: Request parameters to all controller methods"
Write-Host "   2. Add ControllerLogger.logList(), logSuccess(), logView() calls after successful operations"
Write-Host "   3. Add ControllerLogger.logError() calls in catch blocks"
Write-Host "   4. See BULK_CONTROLLER_UPDATE_GUIDE.md for detailed instructions"
Write-Host ""
Write-Host "🎉 Import addition complete!" -ForegroundColor Green