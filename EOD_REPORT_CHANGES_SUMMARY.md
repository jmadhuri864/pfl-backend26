# EOD Report - Recent Changes Summary

## Changes Implemented

### 1. Purchase Total Landing Cost ✅

**Change**: Include both RTV and non-RTV in total landing cost calculation

**Before**:
```json
"purchase": {
  "totalLandingCost": 26500  // Only non-RTV
}
```

**After**:
```json
"purchase": {
  "totalLandingCost": 26500,        // Includes BOTH RTV and non-RTV
  "rtvLandingCost": 2650,           // RTV portion with allocated freight
  "nonRtvLandingCost": 23850        // Non-RTV portion with allocated freight
}
```

**Logic**:
- Total Landing Cost = Total Purchase Amount + Freight + Other Charges
- Includes ALL purchases (both RTV and non-RTV)
- Freight and other charges are proportionally allocated

---

### 2. Customer Returns Salvaged ✅

**Change**: Only include returned items (salvageable), exclude rejected items

**Before**:
```json
"customerReturns": {
  "customerReturnsSalvaged": 1950  // Returned + Rejected
}
```

**After**:
```json
"customerReturns": {
  "customerReturnsSalvaged": 1500  // Only Returned (salvageable)
}
```

**Reason**:
- "Salvaged" means items that can be resold
- Rejected items are damaged and will be dumped or sold as second sale
- Only returned (good quality) items are truly salvaged

---

### 3. Closing Stock with Physical Count Support ✅

**Change**: Support physical stock count when available, with flag

**Before**:
```json
"closingStock": {
  "qty": 975,
  "amount": 51675
}
```

**After**:
```json
"closingStock": {
  "qty": 960,                      // Physical count if available, else calculated
  "calculatedQty": 975,            // Always show calculated value
  "amount": 50880,
  "closingStockAtLandingCost": 50880,
  "closingStockIsPhysical": true   // Flag: true = physical count, false = calculated
}
```

**Logic**:
- If physical stock count is available → use it
- If no physical count → use calculated value
- Always show both values for comparison
- Flag indicates which value is being used

**Use Cases**:
1. **Physical Count Available** (`closingStockIsPhysical: true`)
   - `qty` = Physical count (960 kg)
   - `calculatedQty` = System calculated (975 kg)
   - Variance = 975 - 960 = 15 kg shortage

2. **No Physical Count** (`closingStockIsPhysical: false`)
   - `qty` = Calculated value (975 kg)
   - `calculatedQty` = Same (975 kg)
   - No variance (system-only calculation)

---

### 4. Variance Type Indicator ✅

**Change**: Add variance type classification

**Before**:
```json
"difference": {
  "qty": 15,
  "amount": 795
}
```

**After**:
```json
"difference": {
  "qty": 15,
  "amount": 795,
  "varianceType": "shortage"  // 'shortage', 'surplus', or 'balanced'
}
```

**Logic**:
- `qty > 0` → **"shortage"** (stock is missing)
- `qty < 0` → **"surplus"** (extra stock found)
- `qty = 0` → **"balanced"** (perfect match)

**Business Actions**:
- **Shortage**: Investigate for shrinkage/pilferage
- **Surplus**: Investigate for unrecorded inward/returns
- **Balanced**: No action needed

---

### 5. Net Stock Movement (Corrected) ✅

**Change**: Include second sale and rejected items in calculation

**Before**:
```json
"summary": {
  "netStockMovement": {
    "qty": 70  // Missing second sale
  }
}
```

**After**:
```json
"summary": {
  "netStockMovement": {
    "qty": 55  // Includes second sale and rejected items
  }
}
```

**Formula**:
```
Net Stock Movement = Purchase + Inward + Returns (Returned)
                   - Dump - Sales - Transfer - Second Sale
```

**Why This Matters**:
- Second sale is a sale (stock goes out)
- Must be included in net movement calculation
- Gives accurate picture of stock flow

---

## Complete Example

### Input Data:
- Opening Stock: 1,000 kg
- Purchase: 500 kg @ ₹25,000
  - RTV: 50 kg @ ₹2,500
  - Non-RTV: 450 kg @ ₹22,500
- Freight: ₹1,000
- Other Charges: ₹500
- Inward: 200 kg
- Returns (Returned): 20 kg
- Returns (Rejected): 10 kg
- Dump: 30 kg
- Sales: 600 kg
- Transfer: 100 kg
- Second Sale: 15 kg
- **Physical Count**: 960 kg (actual count)

### Output:

```json
{
  "purchase": {
    "totalPurchaseQty": 500,
    "totalPurchaseAmt": 25000,
    "rtvQty": 50,
    "rtvAmt": 2500,
    "nonRtvQty": 450,
    "nonRtvAmt": 22500,
    "totalFreight": 1000,
    "totalOtherCharges": 500,
    "totalLandingCost": 26500,      // ✅ Includes both RTV and non-RTV
    "rtvLandingCost": 2650,         // ✅ RTV with allocated charges
    "nonRtvLandingCost": 23850      // ✅ Non-RTV with allocated charges
  },
  
  "customerReturns": {
    "totalReturnedQty": 20,
    "totalReturnedAmt": 1500,
    "totalRejectedQty": 10,
    "totalRejectedAmt": 500,
    "customerReturnsSalvaged": 1500  // ✅ Only returned, not rejected
  },
  
  "closingStock": {
    "qty": 960,                      // ✅ Physical count used
    "calculatedQty": 975,            // ✅ System calculated value
    "amount": 50880,
    "closingStockIsPhysical": true   // ✅ Flag indicates physical count
  },
  
  "difference": {
    "qty": 15,                       // ✅ 975 (calculated) - 960 (physical)
    "amount": 795,
    "varianceType": "shortage",      // ✅ Indicates stock shortage
    "breakdown": {
      "naturalShrinkage": 795,
      "pilferage": 0
    }
  },
  
  "summary": {
    "netStockMovement": {
      "qty": 55,                     // ✅ Includes second sale
      "amount": 2915
    }
  }
}
```

---

## Key Benefits

### 1. Accurate Landing Cost
- ✅ All purchases included (RTV + non-RTV)
- ✅ Proper cost allocation
- ✅ Better profitability analysis

### 2. Correct Salvage Value
- ✅ Only truly salvageable items counted
- ✅ Rejected items handled separately
- ✅ Accurate asset valuation

### 3. Physical Count Support
- ✅ Real-world stock verification
- ✅ Variance detection
- ✅ Audit trail

### 4. Clear Variance Classification
- ✅ Immediate identification of issues
- ✅ Actionable insights
- ✅ Better inventory control

### 5. Complete Stock Movement
- ✅ All transactions included
- ✅ Accurate flow analysis
- ✅ Better forecasting

---

## Migration Notes

### For Existing Implementations:

1. **Physical Count Integration**:
   ```typescript
   // When physical count is available:
   const physicalClosingQty = getPhysicalStockCount(); // Your function
   
   // Pass to EOD report calculation
   // The system will automatically use it and set closingStockIsPhysical: true
   ```

2. **Variance Type Usage**:
   ```typescript
   if (report.difference.varianceType === 'shortage') {
     // Investigate shrinkage/pilferage
     triggerInvestigation();
   } else if (report.difference.varianceType === 'surplus') {
     // Check for unrecorded inward
     checkUnrecordedTransactions();
   }
   ```

3. **Landing Cost Breakdown**:
   ```typescript
   // Now you can analyze RTV vs non-RTV costs separately
   const rtvCostPercentage = 
     (report.purchase.rtvLandingCost / report.purchase.totalLandingCost) * 100;
   ```

---

## Testing Checklist

- [ ] Verify total landing cost includes both RTV and non-RTV
- [ ] Confirm customerReturnsSalvaged excludes rejected items
- [ ] Test physical count integration (when available)
- [ ] Verify closingStockIsPhysical flag accuracy
- [ ] Check variance type classification (shortage/surplus/balanced)
- [ ] Validate net stock movement includes second sale
- [ ] Compare calculated vs physical closing stock
- [ ] Test with zero variance scenario
- [ ] Test with negative variance (surplus)
- [ ] Verify all amounts at landing cost
